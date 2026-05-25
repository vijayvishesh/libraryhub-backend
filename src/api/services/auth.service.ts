import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import {
  HttpError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from 'routing-controllers';
import { Service } from 'typedi';
import { AuthJwtPayload, AuthTokenType, AuthUserGender } from '../../types/jwtToken.types';
import {
  AuthRequestGender,
  AuthRequestRole,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordVerifyRequest,
  LoginRequest,
  LogoutRequest,
  MemberOtpLoginSendRequest,
  RefreshSessionRequest,
  RegisterRequest,
  ResendOtpRequest,
  ResetPasswordRequest,
  SendOtpRequest,
  UpdateProfileRequest,
  VerifyOtpWithRoleRequest,
} from '../controllers/requests/auth.request';
import {
  AuthData,
  AuthRegisterData,
  AuthTenantData,
  AuthUserData,
  CurrentSessionData,
  LogoutData,
  SessionTokenData,
} from '../controllers/responses/auth.response';
import { ConflictError } from '../errors/conflict.error';
import { AuthRepository } from '../repositories/auth.repositories';
import { FcmTokenRepository } from '../repositories/fcmToken.repository';
import { MemberRepository } from '../repositories/member.repository';
import {
  AuthOwnerRecord,
  AuthTenantRecord,
  StudentRecord,
} from '../repositories/types/auth.repository.types';

const ACCESS_TOKEN_EXPIRY = '365d';   // ← long-lived; session lives until logout
const REFRESH_TOKEN_EXPIRY = '365d';  // ← same: no forced expiry
const REFRESH_TOKEN_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
const PASSWORD_SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
const STATIC_OTP = '555555';
const SESSION_TOKEN_PLACEHOLDER_HASH = 'SESSION_PENDING_TOKEN_HASH';
const DEFAULT_OWNER_GENDER: AuthUserGender = 'other';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type AuthTokenIdentity = {
  sub: string;
  tid: string;
  sid: string;
  name: string;
  phone: string;
  gender: AuthUserGender;
  role: AuthOwnerRecord['role'];
};

@Service()
/* eslint-disable max-lines */
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly memberRepository: MemberRepository,
    private readonly fcmTokenRepository: FcmTokenRepository,
  ) {}

  public async register(payload: RegisterRequest): Promise<AuthRegisterData> {
    try {
      const phone = this.normalizePhone(payload.phone);
      await this.ensurePhoneNotRegistered(phone);

      const hashedPassword = await bcrypt.hash(payload.password, PASSWORD_SALT_ROUNDS);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      const normalizedRole = this.normalizeRequestRole(payload.role);

      if (normalizedRole === 'OWNER') {
        const pendingOwner = await this.authRepository.upsertPendingOwnerSignup({
          name: payload.name.trim(),
          phone,
          password: hashedPassword,
          libraryName: payload.name.trim(),
          city: '',
          otp: STATIC_OTP,
          expiresAt,
        });

        await this.sendOtpViaWhatsApp(phone, STATIC_OTP);
        return new AuthRegisterData(
          `OTP sent to ${this.toE164IndianPhone(phone)}`,
          pendingOwner.id,
        );
      }

      const pendingStudent = await this.authRepository.upsertPendingStudentSignup({
        name: payload.name.trim(),
        phone,
        gender: this.normalizeRequestGender(payload.gender),
        password: hashedPassword,
        otp: STATIC_OTP,
        expiresAt,
      });

      await this.sendOtpViaWhatsApp(phone, STATIC_OTP);
      return new AuthRegisterData(
        `OTP sent to ${this.toE164IndianPhone(phone)}`,
        pendingStudent.id,
      );
    } catch (error) {
      this.rethrowAuthError(error, 'REGISTER_FAILED');
    }
  }

  public async sendOtp(payload: SendOtpRequest): Promise<number> {
    try {
      const phone = this.normalizePhone(payload.phone);
      const purpose = payload.purpose || 'verify';
      if (purpose === 'verify') {
        await this.ensurePhoneNotRegistered(phone);
      } else {
        await this.ensurePhoneRegistered(phone);
      }

      await this.sendOtpViaWhatsApp(phone, STATIC_OTP);
      return OTP_EXPIRY_MINUTES * 60;
    } catch (error) {
      this.rethrowAuthError(error, 'SEND_OTP_FAILED');
    }
  }

  public async verifyOtpAndLogin(payload: VerifyOtpWithRoleRequest): Promise<AuthData> {
    try {
      const phone = this.normalizePhone(payload.phone);

      // No role = member OTP login / invitation flow
      if (!payload.role) {
        return this.handleMemberOtpVerify(phone, payload.otp, payload.fcmToken, payload.deviceType);
      }

      const normalizedRole = this.normalizeRequestRole(payload.role);
      this.validateOtp(payload.otp);

      if (normalizedRole === 'OWNER') {
        // OWNER: must be a new signup, block if already exists
        await this.ensurePhoneNotRegistered(phone);

        const pendingOwnerSignup = await this.authRepository.findPendingOwnerSignupByPhone(phone);
        if (!pendingOwnerSignup) {
          throw new UnauthorizedError('NO_PENDING_SIGNUP_FOUND');
        }
        if (this.isOtpExpired(pendingOwnerSignup.expiresAt)) {
          throw new UnauthorizedError('OTP_EXPIRED');
        }

        const tenant = await this.authRepository.createTenant({
          name: pendingOwnerSignup.libraryName || pendingOwnerSignup.name,
          city: pendingOwnerSignup.city || '',
          isSetupCompleted: false,
          ownerId: '',
        });
        const owner = await this.authRepository.createOwner({
          tenantId: tenant.id,
          name: pendingOwnerSignup.name,
          phone,
          password: pendingOwnerSignup.password,
          hasCreatedLibrary: false,
          role: 'OWNER',
        });
        await this.authRepository.updateTenantOwnerId(tenant.id, owner.id);
        await this.authRepository.deletePendingOwnerSignupByPhone(phone);
        return this.createOwnerAuthData(owner, tenant);
      }

      // STUDENT role: check if already exists → treat as OTP login, not signup
      const existingStudent = await this.authRepository.findStudentByPhone(phone);
      if (existingStudent) {
        // Student exists → just log in via OTP
        return this.handleMemberOtpVerify(phone, payload.otp, payload.fcmToken, payload.deviceType);
      }

      // New student signup (came from register flow, no account yet)
      const pendingStudentSignup = await this.authRepository.findPendingStudentSignupByPhone(phone);
      if (!pendingStudentSignup) {
        throw new UnauthorizedError('NO_PENDING_SIGNUP_FOUND');
      }
      if (this.isOtpExpired(pendingStudentSignup.expiresAt)) {
        throw new UnauthorizedError('OTP_EXPIRED');
      }

      const student = await this.authRepository.createStudent({
        name: pendingStudentSignup.name,
        phone,
        gender: pendingStudentSignup.gender,
        password: pendingStudentSignup.password,
        isPhoneVerified: true,
        hasJoinedLibrary: false,
        role: 'STUDENT',
      });
      await this.authRepository.deletePendingStudentSignupByPhone(phone);

      if (payload.fcmToken && payload.deviceType) {
        try {
          await this.fcmTokenRepository.upsert({
            studentId: student.id,
            token: payload.fcmToken,
            deviceType: payload.deviceType,
          });
          console.log('✅ FCM token saved for new signup student:', student.id);
        } catch (fcmError) {
          console.warn('FCM token save failed during signup:', fcmError);
        }
      }

      return this.createStudentAuthData(student);
    } catch (error) {
      this.rethrowAuthError(error, 'VERIFY_OTP_FAILED');
    }
  }

  public async login(payload: LoginRequest): Promise<AuthData> {
    try {
      const phone = this.normalizePhone(payload.phone);
      const normalizedRole = this.normalizeRequestRole(payload.role);

      if (normalizedRole === 'OWNER') {
        const owner = await this.authRepository.findOwnerByPhone(phone);
        if (!owner) {
          throw new UnauthorizedError('USER_NOT_FOUND');
        }

        const isPasswordValid = await bcrypt.compare(payload.password, owner.password);
        if (!isPasswordValid) {
          throw new UnauthorizedError('INVALID_PASSWORD');
        }

        const tenant = await this.authRepository.findTenantById(owner.tenantId);
        if (!tenant) {
          throw new UnauthorizedError('TENANT_NOT_FOUND');
        }

        if (payload.fcmToken && payload.deviceType) {
          try {
            await this.fcmTokenRepository.upsertOwner({
              ownerId: owner.id,
              token: payload.fcmToken,
              deviceType: payload.deviceType,
            });
            console.log('✅ FCM token saved for owner login:', owner.id);
          } catch (fcmError) {
            console.warn('FCM token save failed during owner login:', fcmError);
          }
        }

        return this.createOwnerAuthData(owner, tenant);
      }

      const student = await this.authRepository.findStudentByPhone(phone);
      if (!student) {
        throw new UnauthorizedError('USER_NOT_FOUND');
      }

      const isPasswordValid = await bcrypt.compare(payload.password, student.password);
      if (!isPasswordValid) {
        throw new UnauthorizedError('INVALID_PASSWORD');
      }

      if (payload.fcmToken && payload.deviceType) {
        try {
          await this.fcmTokenRepository.upsert({
            studentId: student.id,
            token: payload.fcmToken,
            deviceType: payload.deviceType,
          });
          console.log('✅ FCM token saved for student login:', student.id);
        } catch (fcmError) {
          console.warn('FCM token save failed during login:', fcmError);
        }
      } else {
        console.log('⚠️ No fcmToken in login payload for student:', student.id);
      }

      return this.createStudentAuthData(student);
    } catch (error) {
      this.rethrowAuthError(error, 'LOGIN_FAILED');
    }
  }

  public async refreshSession(payload: RefreshSessionRequest): Promise<SessionTokenData> {
    try {
      const refreshToken = payload.refreshToken.trim();
      const tokenPayload = this.verifyToken(refreshToken, 'refresh');
      const session = await this.getValidSession(tokenPayload);

      if (session.refreshTokenHash !== this.hashToken(refreshToken)) {
        throw new UnauthorizedError('INVALID_OR_EXPIRED_TOKEN');
      }

      if (tokenPayload.role === 'OWNER') {
        const owner = await this.authRepository.findOwnerById(tokenPayload.sub);
        if (!owner) {
          throw new UnauthorizedError('USER_NOT_FOUND');
        }

        const tenant = await this.authRepository.findTenantById(owner.tenantId);
        if (!tenant) {
          throw new UnauthorizedError('TENANT_NOT_FOUND');
        }

        if (tenant.id !== tokenPayload.tid) {
          throw new UnauthorizedError('TOKEN_TENANT_MISMATCH');
        }

        const tokens = this.generateTokens({
          sub: owner.id,
          tid: tenant.id,
          sid: session.id,
          name: owner.name,
          phone: owner.phone,
          gender: DEFAULT_OWNER_GENDER,
          role: owner.role,
        });

        await this.authRepository.rotateAuthSessionRefreshToken({
          sessionId: session.id,
          refreshTokenHash: this.hashToken(tokens.refreshToken),
          expiresAt: this.getRefreshTokenExpiryDate(),
        });

        return new SessionTokenData(tokens.accessToken, tokens.refreshToken);
      }

      if (tokenPayload.role === 'SUPER_ADMIN') {
        const tokens = this.generateTokens({
          sub: tokenPayload.sub,
          tid: '',
          sid: session.id,
          name: tokenPayload.name,
          phone: '',
          gender: 'other',
          role: 'SUPER_ADMIN' as any,
        });

        await this.authRepository.rotateAuthSessionRefreshToken({
          sessionId: session.id,
          refreshTokenHash: this.hashToken(tokens.refreshToken),
          expiresAt: this.getRefreshTokenExpiryDate(),
        });

        return new SessionTokenData(tokens.accessToken, tokens.refreshToken);
      }

      const student = await this.authRepository.findStudentById(tokenPayload.sub);
      if (!student) {
        throw new UnauthorizedError('USER_NOT_FOUND');
      }

      const tokens = this.generateTokens({
        sub: student.id,
        tid: session.tenantId,
        sid: session.id,
        name: student.name,
        phone: student.phone,
        gender: student.gender,
        role: student.role,
      });

      await this.authRepository.rotateAuthSessionRefreshToken({
        sessionId: session.id,
        refreshTokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: this.getRefreshTokenExpiryDate(),
      });

      return new SessionTokenData(tokens.accessToken, tokens.refreshToken);
    } catch (error) {
      this.rethrowAuthError(error, 'REFRESH_SESSION_FAILED');
    }
  }

  // ✅ FIXED — logout never fails; token is optional; revokes session only when valid token provided
  public async logout(payload: LogoutRequest): Promise<LogoutData> {
    try {
      const refreshToken = payload.refreshToken?.trim();

      if (refreshToken) {
        try {
          const tokenPayload = this.verifyToken(refreshToken, 'refresh');
          const session = await this.getValidSession(tokenPayload);

          if (session.refreshTokenHash === this.hashToken(refreshToken)) {
            await this.authRepository.revokeAuthSession(session.id);
          }
        } catch {
          // Token invalid/expired — still succeed; user is logged out on client side
        }
      }

      return new LogoutData('Logged out successfully');
    } catch (error) {
      this.rethrowAuthError(error, 'LOGOUT_FAILED');
    }
  }

  public async getCurrentSession(authorizationHeader?: string): Promise<CurrentSessionData> {
    try {
      const accessToken = this.extractBearerToken(authorizationHeader);
      const payload = this.verifyToken(accessToken, 'access');
      await this.getValidSession(payload);

      if (payload.role === 'SUPER_ADMIN') {
        return new CurrentSessionData(
          new AuthUserData(payload.sub, payload.name, '', 'other', 'SUPER_ADMIN' as any, {}),
        );
      }

      if (payload.role === 'OWNER') {
        const owner = await this.authRepository.findOwnerById(payload.sub);
        if (!owner) {
          throw new UnauthorizedError('USER_NOT_FOUND');
        }

        const tenant = await this.authRepository.findTenantById(owner.tenantId);
        if (!tenant) {
          throw new UnauthorizedError('TENANT_NOT_FOUND');
        }

        if (tenant.id !== payload.tid) {
          throw new UnauthorizedError('TOKEN_TENANT_MISMATCH');
        }

        return new CurrentSessionData(
          new AuthUserData(owner.id, owner.name, owner.phone, DEFAULT_OWNER_GENDER, owner.role, {
            hasCreatedLibrary: owner.hasCreatedLibrary,
            avatarUrl: owner.avatarUrl ?? null,
          }),
          new AuthTenantData(tenant.id, tenant.name, tenant.city, tenant.isSetupCompleted),
        );
      }

      const student = await this.authRepository.findStudentById(payload.sub);
      if (!student) {
        throw new UnauthorizedError('USER_NOT_FOUND');
      }

      return new CurrentSessionData(
        new AuthUserData(student.id, student.name, student.phone, student.gender, student.role, {
          hasJoinedLibrary: student.hasJoinedLibrary,
          email: student.email,
          city: student.city,
          bio: student.bio,
          avatarUrl: student.avatarUrl ?? null,
        }),
      );
    } catch (error) {
      this.rethrowAuthError(error, 'GET_CURRENT_SESSION_FAILED');
    }
  }

  public async updateProfile(
    session: CurrentSessionData,
    payload: UpdateProfileRequest,
  ): Promise<CurrentSessionData> {
    try {
      const role = session.user.role;

      if (role === 'OWNER') {
        const updated = await this.authRepository.updateOwnerProfile(session.user.id, {
          name: payload.name,
        });
        if (!updated) {
          throw new NotFoundError('USER_NOT_FOUND');
        }

        const tenant = session.tenant
          ? new AuthTenantData(
              session.tenant.id,
              session.tenant.name,
              session.tenant.city,
              session.tenant.isSetupCompleted,
            )
          : undefined;

        return new CurrentSessionData(
          new AuthUserData(
            updated.id,
            updated.name,
            updated.phone,
            DEFAULT_OWNER_GENDER,
            updated.role,
            {
              hasCreatedLibrary: updated.hasCreatedLibrary,
            },
          ),
          tenant,
        );
      }

      const updated = await this.authRepository.updateStudentProfile(session.user.id, {
        name: payload.name,
        gender: payload.gender ? this.normalizeRequestGender(payload.gender) : undefined,
        email: payload.email,
        city: payload.city,
        bio: payload.bio,
      });
      if (!updated) {
        throw new NotFoundError('USER_NOT_FOUND');
      }
      if (payload.name) {
        const members = await this.memberRepository.findAllMembersByStudentId(updated.id);

        await Promise.all(
          members.map(member =>
            this.memberRepository.updateMemberByIdAndLibrary(member.id, member.libraryId, {
              fullName: updated.name,
              updatedAt: new Date(),
            }),
          ),
        );
      }
      return new CurrentSessionData(
        new AuthUserData(updated.id, updated.name, updated.phone, updated.gender, updated.role, {
          hasJoinedLibrary: updated.hasJoinedLibrary,
          avatarUrl: updated.avatarUrl ?? null,
        }),
      );
    } catch (error) {
      this.rethrowAuthError(error, 'UPDATE_PROFILE_FAILED');
    }
  }

  private async createOwnerAuthData(
    owner: AuthOwnerRecord,
    tenant: AuthTenantRecord,
  ): Promise<AuthData> {
    const authSession = await this.authRepository.createAuthSession({
      ownerId: owner.id,
      tenantId: tenant.id,
      role: owner.role,
      refreshTokenHash: SESSION_TOKEN_PLACEHOLDER_HASH,
      expiresAt: this.getRefreshTokenExpiryDate(),
    });

    const tokens = this.generateTokens({
      sub: owner.id,
      tid: tenant.id,
      sid: authSession.id,
      name: owner.name,
      phone: owner.phone,
      gender: DEFAULT_OWNER_GENDER,
      role: owner.role,
    });

    await this.authRepository.rotateAuthSessionRefreshToken({
      sessionId: authSession.id,
      refreshTokenHash: this.hashToken(tokens.refreshToken),
      expiresAt: this.getRefreshTokenExpiryDate(),
    });

    return new AuthData(
      tokens.accessToken,
      tokens.refreshToken,
      new AuthUserData(owner.id, owner.name, owner.phone, DEFAULT_OWNER_GENDER, owner.role, {
        hasCreatedLibrary: owner.hasCreatedLibrary,
      }),
      new AuthTenantData(tenant.id, tenant.name, tenant.city, tenant.isSetupCompleted),
    );
  }

  private async createStudentAuthData(student: StudentRecord): Promise<AuthData> {
    const authSession = await this.authRepository.createAuthSession({
      ownerId: student.id,
      tenantId: '',
      role: student.role,
      refreshTokenHash: SESSION_TOKEN_PLACEHOLDER_HASH,
      expiresAt: this.getRefreshTokenExpiryDate(),
    });

    const tokens = this.generateTokens({
      sub: student.id,
      tid: '',
      sid: authSession.id,
      name: student.name,
      phone: student.phone,
      gender: student.gender,
      role: student.role,
    });

    await this.authRepository.rotateAuthSessionRefreshToken({
      sessionId: authSession.id,
      refreshTokenHash: this.hashToken(tokens.refreshToken),
      expiresAt: this.getRefreshTokenExpiryDate(),
    });

    return new AuthData(
      tokens.accessToken,
      tokens.refreshToken,
      new AuthUserData(student.id, student.name, student.phone, student.gender, student.role, {
        hasJoinedLibrary: student.hasJoinedLibrary,
        email: student.email,
        city: student.city,
        bio: student.bio,
      }),
    );
  }

  private normalizePhone(phone: string): string {
    const trimmedPhone = phone.trim().replace(/\s+/g, '');
    if (trimmedPhone.startsWith('+91') && trimmedPhone.length === 13) {
      return trimmedPhone.slice(3);
    }

    if (trimmedPhone.startsWith('91') && trimmedPhone.length === 12) {
      return trimmedPhone.slice(2);
    }

    return trimmedPhone;
  }

  private toE164IndianPhone(phone: string): string {
    const normalizedPhone = this.normalizePhone(phone);
    return `+91${normalizedPhone}`;
  }

  private normalizeRequestRole(role: AuthRequestRole): 'OWNER' | 'STUDENT' {
    return role === 'owner' ? 'OWNER' : 'STUDENT';
  }

  private normalizeRequestGender(gender?: AuthRequestGender): AuthUserGender {
    if (!gender) {
      return 'other';
    }

    return gender;
  }

  private extractBearerToken(authorizationHeader?: string): string {
    if (!authorizationHeader || !authorizationHeader.trim()) {
      throw new UnauthorizedError('MISSING_AUTH_TOKEN');
    }

    const [scheme, token] = authorizationHeader.trim().split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedError('INVALID_AUTH_HEADER');
    }

    return token.trim();
  }

  private verifyToken(token: string, expectedType: AuthTokenType): AuthJwtPayload {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new InternalServerError('JWT_SECRET_MISCONFIGURED');
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (!this.isValidAuthJwtPayload(decoded, expectedType)) {
        throw new UnauthorizedError('INVALID_OR_EXPIRED_TOKEN');
      }

      return decoded;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new UnauthorizedError('INVALID_OR_EXPIRED_TOKEN');
    }
  }

  private isValidAuthJwtPayload(
    payload: string | jwt.JwtPayload,
    expectedType: AuthTokenType,
  ): payload is AuthJwtPayload {
    if (!payload || typeof payload === 'string') {
      return false;
    }

    const role = payload.role;
    const gender = payload.gender;
    const tokenType = payload.type;
    return (
      typeof payload.sub === 'string' &&
      typeof payload.tid === 'string' &&
      typeof payload.sid === 'string' &&
      typeof payload.name === 'string' &&
      typeof payload.phone === 'string' &&
      (gender === 'male' || gender === 'female' || gender === 'other') &&
      (role === 'OWNER' || role === 'STUDENT' || role === 'SUPER_ADMIN') &&
      (tokenType === 'access' || tokenType === 'refresh') &&
      tokenType === expectedType
    );
  }

  private async getValidSession(payload: AuthJwtPayload): Promise<{
    id: string;
    ownerId: string;
    tenantId: string;
    role: AuthOwnerRecord['role'];
    refreshTokenHash: string;
    isRevoked: boolean;
    expiresAt: Date;
  }> {
    const session = await this.authRepository.findAuthSessionById(payload.sid);
    if (!session) {
      throw new UnauthorizedError('SESSION_NOT_FOUND');
    }

    if (session.isRevoked) {
      throw new UnauthorizedError('SESSION_REVOKED');
    }

    // ✅ No session expiry check — session lives until user explicitly logs out

    if (
      session.ownerId !== payload.sub ||
      session.tenantId !== payload.tid ||
      session.role !== payload.role
    ) {
      throw new UnauthorizedError('SESSION_TOKEN_MISMATCH');
    }

    return {
      id: session.id,
      ownerId: session.ownerId,
      tenantId: session.tenantId,
      role: session.role,
      refreshTokenHash: session.refreshTokenHash,
      isRevoked: session.isRevoked,
      expiresAt: session.expiresAt,
    };
  }

  private async ensurePhoneNotRegistered(phone: string): Promise<void> {
    const [owner, student] = await Promise.all([
      this.authRepository.findOwnerByPhone(phone),
      this.authRepository.findStudentByPhone(phone),
    ]);

    if (owner || student) {
      throw new ConflictError('PHONE_ALREADY_EXISTS');
    }
  }

  private async ensurePhoneRegistered(phone: string): Promise<void> {
    const [owner, student] = await Promise.all([
      this.authRepository.findOwnerByPhone(phone),
      this.authRepository.findStudentByPhone(phone),
    ]);

    if (!owner && !student) {
      throw new UnauthorizedError('USER_NOT_FOUND');
    }
  }

  private validateOtp(otp: string): void {
    if (otp.trim() !== STATIC_OTP) {
      throw new UnauthorizedError('INVALID_OTP');
    }
  }

  private isOtpExpired(expiresAt: Date): boolean {
    return expiresAt.getTime() < Date.now();
  }

  private async sendOtpViaWhatsApp(phone: string, otp: string): Promise<void> {
    void phone;
    void otp;
    // Placeholder for WhatsApp provider integration.
  }

  private generateTokens(payload: AuthTokenIdentity): AuthTokens {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new InternalServerError('JWT_SECRET_MISCONFIGURED');
    }

    return {
      accessToken: jwt.sign({ ...payload, type: 'access' }, jwtSecret, {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_EXPIRY,
      }),
      refreshToken: jwt.sign({ ...payload, type: 'refresh' }, jwtSecret, {
        algorithm: 'HS256',
        expiresIn: REFRESH_TOKEN_EXPIRY,
      }),
    };
  }

  private getRefreshTokenExpiryDate(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private rethrowAuthError(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) {
      throw error;
    }

    if (this.isDuplicatePhoneError(error)) {
      throw new ConflictError('PHONE_ALREADY_EXISTS');
    }

    throw new InternalServerError(defaultMessage);
  }

  private isDuplicatePhoneError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const errorCode = (error as { code?: number }).code;
    return errorCode === 11000;
  }

  public async changePassword(
    session: CurrentSessionData,
    payload: ChangePasswordRequest,
  ): Promise<void> {
    try {
      if (payload.newPassword !== payload.confirmPassword) {
        throw new HttpError(400, 'PASSWORDS_DO_NOT_MATCH');
      }

      const role = session.user.role;

      if (role === 'OWNER') {
        const owner = await this.authRepository.findOwnerById(session.user.id);
        if (!owner) {
          throw new NotFoundError('USER_NOT_FOUND');
        }

        const isValid = await bcrypt.compare(payload.oldPassword, owner.password);
        if (!isValid) {
          throw new HttpError(400, 'INVALID_OLD_PASSWORD');
        }

        const hashed = await bcrypt.hash(payload.newPassword, PASSWORD_SALT_ROUNDS);
        await this.authRepository.updateOwnerPassword(session.user.id, hashed);
        return;
      }

      const student = await this.authRepository.findStudentById(session.user.id);
      if (!student) {
        throw new NotFoundError('USER_NOT_FOUND');
      }

      const isValid = await bcrypt.compare(payload.oldPassword, student.password);
      if (!isValid) {
        throw new HttpError(400, 'INVALID_OLD_PASSWORD');
      }

      const hashed = await bcrypt.hash(payload.newPassword, PASSWORD_SALT_ROUNDS);
      await this.authRepository.updateStudentPassword(session.user.id, hashed);
    } catch (error) {
      this.rethrowAuthError(error, 'CHANGE_PASSWORD_FAILED');
    }
  }

  public async forgotPassword(payload: ForgotPasswordRequest): Promise<number> {
    try {
      const phone = this.normalizePhone(payload.phone);
      const normalizedRole = this.normalizeRequestRole(payload.role);

      if (normalizedRole === 'OWNER') {
        const owner = await this.authRepository.findOwnerByPhone(phone);
        if (!owner) {
          throw new UnauthorizedError('USER_NOT_FOUND');
        }
      } else {
        const student = await this.authRepository.findStudentByPhone(phone);
        if (!student) {
          throw new UnauthorizedError('USER_NOT_FOUND');
        }
      }

      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      await this.authRepository.savePasswordResetToken(
        phone,
        normalizedRole,
        STATIC_OTP,
        expiresAt,
      );
      await this.sendOtpViaWhatsApp(phone, STATIC_OTP);
      return OTP_EXPIRY_MINUTES * 60;
    } catch (error) {
      this.rethrowAuthError(error, 'FORGOT_PASSWORD_FAILED');
    }
  }

  public async forgotPasswordVerify(payload: ForgotPasswordVerifyRequest): Promise<string> {
    try {
      const phone = this.normalizePhone(payload.phone);
      const normalizedRole = this.normalizeRequestRole(payload.role);

      this.validateOtp(payload.otp);

      const isValid = await this.authRepository.findAndValidateResetToken(
        phone,
        normalizedRole,
        payload.otp,
      );
      if (!isValid) {
        throw new UnauthorizedError('INVALID_OR_EXPIRED_OTP');
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new InternalServerError('JWT_SECRET_MISCONFIGURED');
      }

      const resetToken = jwt.sign({ phone, role: normalizedRole, type: 'reset' }, jwtSecret, {
        expiresIn: '15m',
      });

      return resetToken;
    } catch (error) {
      this.rethrowAuthError(error, 'FORGOT_PASSWORD_VERIFY_FAILED');
    }
  }

  public async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    try {
      if (payload.newPassword !== payload.confirmPassword) {
        throw new HttpError(400, 'PASSWORDS_DO_NOT_MATCH');
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new InternalServerError('JWT_SECRET_MISCONFIGURED');
      }

      let decoded: any;
      try {
        decoded = jwt.verify(payload.resetToken, jwtSecret);
      } catch {
        throw new UnauthorizedError('INVALID_OR_EXPIRED_RESET_TOKEN');
      }

      if (decoded.type !== 'reset') {
        throw new UnauthorizedError('INVALID_RESET_TOKEN');
      }

      const phone = decoded.phone;
      const role = decoded.role;
      const hashed = await bcrypt.hash(payload.newPassword, PASSWORD_SALT_ROUNDS);

      if (role === 'OWNER') {
        const owner = await this.authRepository.findOwnerByPhone(phone);
        if (!owner) {
          throw new NotFoundError('USER_NOT_FOUND');
        }
        await this.authRepository.updateOwnerPassword(owner.id, hashed);
        return;
      }

      const student = await this.authRepository.findStudentByPhone(phone);
      if (!student) {
        throw new NotFoundError('USER_NOT_FOUND');
      }
      await this.authRepository.updateStudentPassword(student.id, hashed);
    } catch (error) {
      this.rethrowAuthError(error, 'RESET_PASSWORD_FAILED');
    }
  }

  public async resendOtp(payload: ResendOtpRequest): Promise<number> {
    try {
      const phone = this.normalizePhone(payload.phone);

      // ── Branch 1: member-login resend ─────────────────────────────────────
      if (payload.purpose === 'member-login') {
        const [members, existingStudent, existingPending] = await Promise.all([
          this.memberRepository.findAllMembersByPhone(phone),
          this.authRepository.findStudentByPhone(phone),
          this.authRepository.findPendingStudentSignupByPhone(phone),
        ]);

        if (!existingStudent && !members.length && !existingPending) {
          throw new UnauthorizedError('USER_NOT_FOUND');
        }

        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        const name =
          existingPending?.name ??
          existingStudent?.name ??
          members[0]?.fullName ??
          '';
        const gender =
          existingPending?.gender ??
          existingStudent?.gender ??
          'other';
        const password =
          existingPending?.password ??
          existingStudent?.password ??
          '';

        await this.authRepository.upsertPendingStudentSignup({
          name,
          phone,
          gender,
          password,
          otp: STATIC_OTP,
          expiresAt,
        });

        await this.sendOtpViaWhatsApp(phone, STATIC_OTP);
        return OTP_EXPIRY_MINUTES * 60;
      }

      // ── Branch 2: register resend ─────────────────────────────────────────
      if (payload.purpose === 'register') {
        if (!payload.role) {
          throw new HttpError(400, 'ROLE_REQUIRED_FOR_REGISTER_RESEND');
        }

        const normalizedRole = this.normalizeRequestRole(payload.role);

        if (normalizedRole === 'OWNER') {
          const pendingOwner = await this.authRepository.findPendingOwnerSignupByPhone(phone);
          if (!pendingOwner) {
            throw new UnauthorizedError('NO_PENDING_SIGNUP_FOUND');
          }

          const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
          await this.authRepository.upsertPendingOwnerSignup({
            ...pendingOwner,
            otp: STATIC_OTP,
            expiresAt,
          });
          await this.sendOtpViaWhatsApp(phone, STATIC_OTP);
          return OTP_EXPIRY_MINUTES * 60;
        }

        // STUDENT register resend
        const pendingStudent = await this.authRepository.findPendingStudentSignupByPhone(phone);
        if (!pendingStudent) {
          throw new UnauthorizedError('NO_PENDING_SIGNUP_FOUND');
        }

        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        await this.authRepository.upsertPendingStudentSignup({
          ...pendingStudent,
          otp: STATIC_OTP,
          expiresAt,
        });
        await this.sendOtpViaWhatsApp(phone, STATIC_OTP);
        return OTP_EXPIRY_MINUTES * 60;
      }

      // ── Branch 3: forgot-password resend ──────────────────────────────────
      if (!payload.role) {
        throw new HttpError(400, 'ROLE_REQUIRED_FOR_PASSWORD_RESEND');
      }

      const normalizedRole = this.normalizeRequestRole(payload.role);

      if (normalizedRole === 'OWNER') {
        const owner = await this.authRepository.findOwnerByPhone(phone);
        if (!owner) {
          throw new UnauthorizedError('USER_NOT_FOUND');
        }
      } else {
        const student = await this.authRepository.findStudentByPhone(phone);
        if (!student) {
          throw new UnauthorizedError('USER_NOT_FOUND');
        }
      }

      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      await this.authRepository.savePasswordResetToken(
        phone,
        normalizedRole,
        STATIC_OTP,
        expiresAt,
      );
      await this.sendOtpViaWhatsApp(phone, STATIC_OTP);
      return OTP_EXPIRY_MINUTES * 60;
    } catch (error) {
      this.rethrowAuthError(error, 'RESEND_OTP_FAILED');
    }
  }

  public async memberOtpLoginSend(payload: MemberOtpLoginSendRequest): Promise<{
    phone: string;
    expiresIn: number;
    hasAccount: boolean;
  }> {
    try {
      const phone = this.normalizePhone(payload.phone);

      const existingStudent = await this.authRepository.findStudentByPhone(phone);
      const members = await this.memberRepository.findAllMembersByPhone(phone);

      if (!existingStudent && !members.length) {
        throw new UnauthorizedError('USER_NOT_FOUND');
      }

      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      const name = existingStudent?.name ?? members[0]?.fullName ?? '';

      await this.authRepository.upsertPendingStudentSignup({
        name,
        phone,
        gender: existingStudent?.gender ?? 'other',
        password: existingStudent?.password ?? '',
        otp: STATIC_OTP,
        expiresAt,
      });

      await this.sendOtpViaWhatsApp(phone, STATIC_OTP);

      return {
        phone: this.toE164IndianPhone(phone),
        expiresIn: OTP_EXPIRY_MINUTES * 60,
        hasAccount: !!existingStudent,
      };
    } catch (error) {
      this.rethrowAuthError(error, 'MEMBER_OTP_SEND_FAILED');
    }
  }

  private async handleMemberOtpVerify(
    phone: string,
    otp: string,
    fcmToken?: string,
    deviceType?: string,
  ): Promise<AuthData> {
    // 1. Validate OTP
    this.validateOtp(otp);

    // 2. Find pending OTP record
    const pending = await this.authRepository.findPendingStudentSignupByPhone(phone);
    if (!pending) {
      throw new UnauthorizedError('NO_PENDING_OTP_FOUND');
    }
    if (this.isOtpExpired(pending.expiresAt)) {
      throw new UnauthorizedError('OTP_EXPIRED');
    }

    // 3. Check members and existing student in parallel
    const [members, existingStudent] = await Promise.all([
      this.memberRepository.findAllMembersByPhone(phone),
      this.authRepository.findStudentByPhone(phone),
    ]);

    if (!existingStudent && !members.length) {
      throw new UnauthorizedError('USER_NOT_FOUND');
    }

    // 4. If student account already exists → just log in
    if (existingStudent) {
      await this.authRepository.deletePendingStudentSignupByPhone(phone);

      // Link any unlinked member records
      const unlinkedMembers = members.filter(m => !m.studentId);
      if (unlinkedMembers.length) {
        await Promise.all(
          unlinkedMembers.map(m =>
            this.memberRepository.updateMemberByIdAndLibrary(m.id, m.libraryId, {
              studentId: existingStudent.id,
              updatedAt: new Date(),
            }),
          ),
        );
      }

      if (fcmToken && deviceType) {
        try {
          await this.fcmTokenRepository.upsert({
            studentId: existingStudent.id,
            token: fcmToken,
            deviceType,
          });
          console.log('✅ FCM token saved for OTP login (existing student):', existingStudent.id);
        } catch (fcmError) {
          console.warn('FCM token save failed during OTP login:', fcmError);
        }
      }

      return this.createStudentAuthData(existingStudent);
    }

    // 5. No student account but has member records → create from member data
    const primaryMember = members[0];
    const tempPassword = await bcrypt.hash(
      `member_otp_${phone}_${Date.now()}`,
      PASSWORD_SALT_ROUNDS,
    );

    const student = await this.authRepository.createStudent({
      name: primaryMember.fullName,
      phone,
      gender: 'other',
      password: tempPassword,
      isPhoneVerified: true,
      hasJoinedLibrary: members.length > 0,
      role: 'STUDENT',
    });

    // 6. Link all member records to new student
    if (members.length) {
      await Promise.all(
        members.map(m =>
          this.memberRepository.updateMemberByIdAndLibrary(m.id, m.libraryId, {
            studentId: student.id,
            updatedAt: new Date(),
          }),
        ),
      );
    }

    await this.authRepository.deletePendingStudentSignupByPhone(phone);

    if (fcmToken && deviceType) {
      try {
        await this.fcmTokenRepository.upsert({
          studentId: student.id,
          token: fcmToken,
          deviceType,
        });
        console.log('✅ FCM token saved for OTP login (new student from member):', student.id);
      } catch (fcmError) {
        console.warn('FCM token save failed during member OTP login:', fcmError);
      }
    }

    return this.createStudentAuthData(student);
  }
}