import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { BadRequestError, InternalServerError, UnauthorizedError } from 'routing-controllers';
import { Service } from 'typedi';
import { SuperAdminRepository } from '../repositories/superAdmin.repository';
import { AuthRepository } from '../repositories/auth.repositories';
import { SuperAdminRecord } from '../repositories/types/superAdmin.repository.types';
import {
  CreateSuperAdminRequest,
  SuperAdminLoginRequest,
} from '../controllers/requests/superAdmin.request';

const ACCESS_TOKEN_EXPIRY = '60m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 10;
const SESSION_TOKEN_PLACEHOLDER_HASH = 'SESSION_PENDING_TOKEN_HASH';

@Service()
export class SuperAdminService {
  constructor(
    private readonly superAdminRepository: SuperAdminRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  public async login(input: SuperAdminLoginRequest): Promise<{
    accessToken: string;
    refreshToken: string;
    admin: SuperAdminRecord;
  }> {
    const admin = await this.superAdminRepository.findByEmail(input.email);
    if (!admin || !admin.isActive) {
      throw new UnauthorizedError('INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(input.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('INVALID_CREDENTIALS');
    }

    const authSession = await this.authRepository.createAuthSession({
      ownerId: admin.id,
      tenantId: '',
      role: 'SUPER_ADMIN',
      refreshTokenHash: SESSION_TOKEN_PLACEHOLDER_HASH,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });

    const tokens = this.generateTokens({
      sub: admin.id,
      tid: '',
      sid: authSession.id,
      name: admin.name,
      email: admin.email,
    });

    await this.authRepository.rotateAuthSessionRefreshToken({
      sessionId: authSession.id,
      refreshTokenHash: this.hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });

    return { ...tokens, admin };
  }

  public async createSuperAdmin(input: CreateSuperAdminRequest): Promise<SuperAdminRecord> {
    const existing = await this.superAdminRepository.findByEmail(input.email);
    if (existing) {
      throw new BadRequestError('EMAIL_ALREADY_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
    return this.superAdminRepository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
    });
  }

  public async getAdminById(id: string): Promise<SuperAdminRecord | null> {
    return this.superAdminRepository.findById(id);
  }

  private generateTokens(payload: {
    sub: string;
    tid: string;
    sid: string;
    name: string;
    email: string;
  }): { accessToken: string; refreshToken: string } {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new InternalServerError('JWT_SECRET_MISCONFIGURED');
    }

    const basePayload = {
      ...payload,
      phone: '',
      gender: 'other',
      role: 'SUPER_ADMIN',
    };

    return {
      accessToken: jwt.sign({ ...basePayload, type: 'access' }, jwtSecret, {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_EXPIRY,
      }),
      refreshToken: jwt.sign({ ...basePayload, type: 'refresh' }, jwtSecret, {
        algorithm: 'HS256',
        expiresIn: REFRESH_TOKEN_EXPIRY,
      }),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}