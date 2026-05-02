import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { AuthSessionModel } from '../models/authSession.model';
import { PendingOwnerSignupModel } from '../models/pendingOwnerSignup.model';
import { PendingStudentSignupModel } from '../models/pendingStudentSignup.model';
import { StudentModel } from '../models/student.model';
import { TenantModel } from '../models/tenant.model';
import { UserModel } from '../models/user.model';
import {
  AuthOwnerRecord,
  AuthSessionRecord,
  AuthTenantRecord,
  CreateAuthSessionInput,
  CreateOwnerInput,
  CreateStudentInput,
  CreateTenantInput,
  PendingOwnerSignupRecord,
  PendingStudentSignupRecord,
  RotateAuthSessionRefreshTokenInput,
  StudentRecord,
  UpdateOwnerProfileInput,
  UpdateStudentProfileInput,
  UpsertPendingOwnerSignupInput,
  UpsertPendingStudentSignupInput,
} from './types/auth.repository.types';

type WithObjectId = {
  id: ObjectId;
};

@Service()
export class AuthRepository {
  public async findOwnerByPhone(phone: string): Promise<AuthOwnerRecord | null> {
    const owner = await this.getOwnerRepository().findOneBy({ phone });
    if (!owner) {
      return null;
    }

    return this.mapOwner(owner);
  }

  public async findOwnerById(ownerId: string): Promise<AuthOwnerRecord | null> {
    const objectId = this.tryParseObjectId(ownerId);
    if (!objectId) {
      return null;
    }

    const owner = await this.getOwnerRepository().findOneById(objectId);
    if (!owner) {
      return null;
    }

    return this.mapOwner(owner);
  }

  public async createOwner(input: CreateOwnerInput): Promise<AuthOwnerRecord> {
    const ownerRepository = this.getOwnerRepository();
    const owner = ownerRepository.create({
      tenantId: input.tenantId,
      name: input.name,
      phone: input.phone,
      password: input.password,
      hasCreatedLibrary: input.hasCreatedLibrary,
      role: input.role,
    });

    const savedOwner = await ownerRepository.save(owner);
    return this.mapOwner(savedOwner);
  }

  public async createTenant(input: CreateTenantInput): Promise<AuthTenantRecord> {
    const tenantRepository = this.getTenantRepository();
    const tenant = tenantRepository.create({
      name: input.name,
      ownerId: input.ownerId,
      city: input.city,
      isSetupCompleted: input.isSetupCompleted,
    });

    const savedTenant = await tenantRepository.save(tenant);
    return this.mapTenant(savedTenant);
  }

  public async updateTenantOwnerId(tenantId: string, ownerId: string): Promise<void> {
    const objectId = this.tryParseObjectId(tenantId);
    if (!objectId) {
      return;
    }

    const tenantRepository = this.getTenantRepository();
    const tenant = await tenantRepository.findOneById(objectId);
    if (!tenant) {
      return;
    }

    tenant.ownerId = ownerId;
    await tenantRepository.save(tenant);
  }

  public async updateTenantSetupCompleted(
    tenantId: string,
    isSetupCompleted: boolean,
  ): Promise<void> {
    const objectId = this.tryParseObjectId(tenantId);
    if (!objectId) {
      return;
    }

    const tenantRepository = this.getTenantRepository();
    const tenant = await tenantRepository.findOneById(objectId);
    if (!tenant) {
      return;
    }

    tenant.isSetupCompleted = isSetupCompleted;
    await tenantRepository.save(tenant);
  }

  public async updateOwnerHasCreatedLibrary(
    ownerId: string,
    hasCreatedLibrary: boolean,
  ): Promise<void> {
    const objectId = this.tryParseObjectId(ownerId);
    if (!objectId) {
      return;
    }

    const ownerRepository = this.getOwnerRepository();
    const owner = await ownerRepository.findOneById(objectId);
    if (!owner) {
      return;
    }

    owner.hasCreatedLibrary = hasCreatedLibrary;
    await ownerRepository.save(owner);
  }

  public async findTenantById(tenantId: string): Promise<AuthTenantRecord | null> {
    const objectId = this.tryParseObjectId(tenantId);
    if (!objectId) {
      return null;
    }

    const tenant = await this.getTenantRepository().findOneById(objectId);
    if (!tenant) {
      return null;
    }

    return this.mapTenant(tenant);
  }

  public async findStudentByPhone(phone: string): Promise<StudentRecord | null> {
    const student = await this.getStudentRepository().findOneBy({ phone });
    if (!student) {
      return null;
    }

    return this.mapStudent(student);
  }

  public async findStudentById(studentId: string): Promise<StudentRecord | null> {
    const objectId = this.tryParseObjectId(studentId);
    if (!objectId) {
      return null;
    }

    const student = await this.getStudentRepository().findOneById(objectId);
    if (!student) {
      return null;
    }

    return this.mapStudent(student);
  }

  public async createStudent(input: CreateStudentInput): Promise<StudentRecord> {
    const studentRepository = this.getStudentRepository();
    const student = studentRepository.create({
      name: input.name,
      phone: input.phone,
      gender: input.gender,
      password: input.password,
      isPhoneVerified: input.isPhoneVerified,
      hasJoinedLibrary: input.hasJoinedLibrary,
      role: input.role,
    });

    const savedStudent = await studentRepository.save(student);
    return this.mapStudent(savedStudent);
  }

  public async upsertPendingOwnerSignup(
    input: UpsertPendingOwnerSignupInput,
  ): Promise<PendingOwnerSignupRecord> {
    const pendingRepository = this.getPendingOwnerSignupRepository();
    const now = new Date();
    const existing = await pendingRepository.findOneBy({ phone: input.phone });

    if (existing) {
      existing.name = input.name;
      existing.password = input.password;
      existing.libraryName = input.libraryName;
      existing.city = input.city;
      existing.otp = input.otp;
      existing.expiresAt = input.expiresAt;
      existing.updatedAt = now;

      const savedPending = await pendingRepository.save(existing);
      return this.mapPendingOwnerSignup(savedPending);
    }

    const pending = pendingRepository.create({
      name: input.name,
      phone: input.phone,
      password: input.password,
      libraryName: input.libraryName,
      city: input.city,
      otp: input.otp,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    const savedPending = await pendingRepository.save(pending);
    return this.mapPendingOwnerSignup(savedPending);
  }

  public async findPendingOwnerSignupByPhone(
    phone: string,
  ): Promise<PendingOwnerSignupRecord | null> {
    const pending = await this.getPendingOwnerSignupRepository().findOneBy({ phone });
    if (!pending) {
      return null;
    }

    return this.mapPendingOwnerSignup(pending);
  }

  public async deletePendingOwnerSignupByPhone(phone: string): Promise<void> {
    await this.getPendingOwnerSignupRepository().deleteOne({ phone });
  }

  public async upsertPendingStudentSignup(
    input: UpsertPendingStudentSignupInput,
  ): Promise<PendingStudentSignupRecord> {
    const pendingRepository = this.getPendingStudentSignupRepository();
    const now = new Date();
    const existing = await pendingRepository.findOneBy({ phone: input.phone });

    if (existing) {
      existing.name = input.name;
      existing.password = input.password;
      existing.gender = input.gender;
      existing.otp = input.otp;
      existing.expiresAt = input.expiresAt;
      existing.updatedAt = now;

      const savedPending = await pendingRepository.save(existing);
      return this.mapPendingStudentSignup(savedPending);
    }

    const pending = pendingRepository.create({
      name: input.name,
      phone: input.phone,
      gender: input.gender,
      password: input.password,
      otp: input.otp,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    const savedPending = await pendingRepository.save(pending);
    return this.mapPendingStudentSignup(savedPending);
  }

  public async findPendingStudentSignupByPhone(
    phone: string,
  ): Promise<PendingStudentSignupRecord | null> {
    const pending = await this.getPendingStudentSignupRepository().findOneBy({ phone });
    if (!pending) {
      return null;
    }

    return this.mapPendingStudentSignup(pending);
  }

  public async deletePendingStudentSignupByPhone(phone: string): Promise<void> {
    await this.getPendingStudentSignupRepository().deleteOne({ phone });
  }

  public async updateStudentHasJoinedLibrary(
    studentId: string,
    hasJoinedLibrary: boolean,
  ): Promise<void> {
    const objectId = this.tryParseObjectId(studentId);
    if (!objectId) {
      return;
    }

    const studentRepository = this.getStudentRepository();
    const student = await studentRepository.findOneById(objectId);
    if (!student) {
      return;
    }

    student.hasJoinedLibrary = hasJoinedLibrary;
    await studentRepository.save(student);
  }

  public async updateOwnerProfile(
    ownerId: string,
    input: UpdateOwnerProfileInput,
  ): Promise<AuthOwnerRecord | null> {
    const objectId = this.tryParseObjectId(ownerId);
    if (!objectId) {
      return null;
    }

    const ownerRepository = this.getOwnerRepository();
    const owner = await ownerRepository.findOneById(objectId);
    if (!owner) {
      return null;
    }

    if (input.name !== undefined) {
      owner.name = input.name;
    }

    const savedOwner = await ownerRepository.save(owner);
    return this.mapOwner(savedOwner);
  }

  public async updateStudentProfile(
    studentId: string,
    input: UpdateStudentProfileInput,
  ): Promise<StudentRecord | null> {
    const objectId = this.tryParseObjectId(studentId);
    if (!objectId) {
      return null;
    }

    const studentRepository = this.getStudentRepository();
    const student = await studentRepository.findOneById(objectId);
    if (!student) {
      return null;
    }

    if (input.name !== undefined) {
      student.name = input.name;
    }
    if (input.gender !== undefined) {
      student.gender = input.gender;
    }
    if (input.email !== undefined) {
      student.email = input.email;
    }
    if (input.city !== undefined) {
      student.city = input.city;
    }
    if (input.bio !== undefined) {
      student.bio = input.bio;
    }

    const savedStudent = await studentRepository.save(student);
    return this.mapStudent(savedStudent);
  }

  public async createAuthSession(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    const sessionRepository = this.getAuthSessionRepository();
    const now = new Date();
    const session = sessionRepository.create({
      ownerId: input.ownerId,
      tenantId: input.tenantId,
      role: input.role,
      refreshTokenHash: input.refreshTokenHash,
      isRevoked: false,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    });

    const savedSession = await sessionRepository.save(session);
    return this.mapAuthSession(savedSession);
  }

  public async findAuthSessionById(sessionId: string): Promise<AuthSessionRecord | null> {
    const objectId = this.tryParseObjectId(sessionId);
    if (!objectId) {
      return null;
    }

    const session = await this.getAuthSessionRepository().findOneById(objectId);
    if (!session) {
      return null;
    }

    return this.mapAuthSession(session);
  }

  public async rotateAuthSessionRefreshToken(
    input: RotateAuthSessionRefreshTokenInput,
  ): Promise<void> {
    const objectId = this.tryParseObjectId(input.sessionId);
    if (!objectId) {
      return;
    }

    const sessionRepository = this.getAuthSessionRepository();
    const session = await sessionRepository.findOneById(objectId);
    if (!session) {
      return;
    }

    const now = new Date();
    session.refreshTokenHash = input.refreshTokenHash;
    session.expiresAt = input.expiresAt;
    session.updatedAt = now;
    session.lastUsedAt = now;

    await sessionRepository.save(session);
  }

  public async revokeAuthSession(sessionId: string): Promise<void> {
    const objectId = this.tryParseObjectId(sessionId);
    if (!objectId) {
      return;
    }

    const sessionRepository = this.getAuthSessionRepository();
    const session = await sessionRepository.findOneById(objectId);
    if (!session) {
      return;
    }

    const now = new Date();
    session.isRevoked = true;
    session.updatedAt = now;
    session.lastUsedAt = now;

    await sessionRepository.save(session);
  }

  private mapOwner(owner: UserModel): AuthOwnerRecord {
    return {
      id: this.toHexString(owner),
      tenantId: owner.tenantId,
      name: owner.name,
      phone: owner.phone,
      password: owner.password,
      hasCreatedLibrary: owner.hasCreatedLibrary ?? false,
      role: owner.role as AuthOwnerRecord['role'],
    };
  }

  private mapTenant(tenant: TenantModel): AuthTenantRecord {
    return {
      id: this.toHexString(tenant),
      name: tenant.name,
      ownerId: tenant.ownerId,
      city: tenant.city,
      isSetupCompleted: tenant.isSetupCompleted,
    };
  }

  private mapStudent(student: StudentModel): StudentRecord {
    return {
      id: this.toHexString(student),
      name: student.name,
      phone: student.phone,
      gender: student.gender || 'other',
      password: student.password,
      isPhoneVerified: student.isPhoneVerified,
      hasJoinedLibrary: student.hasJoinedLibrary ?? false,
      role: (student.role as StudentRecord['role']) || 'STUDENT',
      email: student.email ?? null,
      city: student.city ?? null,
      bio: student.bio ?? null,
    };
  }

  private mapPendingOwnerSignup(pending: PendingOwnerSignupModel): PendingOwnerSignupRecord {
    return {
      id: this.toHexString(pending),
      name: pending.name,
      phone: pending.phone,
      password: pending.password,
      libraryName: pending.libraryName,
      city: pending.city,
      otp: pending.otp,
      expiresAt: pending.expiresAt,
      createdAt: pending.createdAt,
      updatedAt: pending.updatedAt,
    };
  }

  private mapPendingStudentSignup(pending: PendingStudentSignupModel): PendingStudentSignupRecord {
    return {
      id: this.toHexString(pending),
      name: pending.name,
      phone: pending.phone,
      gender: pending.gender || 'other',
      password: pending.password,
      otp: pending.otp,
      expiresAt: pending.expiresAt,
      createdAt: pending.createdAt,
      updatedAt: pending.updatedAt,
    };
  }

  private mapAuthSession(session: AuthSessionModel): AuthSessionRecord {
    return {
      id: this.toHexString(session),
      ownerId: session.ownerId,
      tenantId: session.tenantId,
      role: session.role as AuthSessionRecord['role'],
      refreshTokenHash: session.refreshTokenHash,
      isRevoked: session.isRevoked,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastUsedAt: session.lastUsedAt,
    };
  }

  private toHexString(value: WithObjectId): string {
    return value.id.toHexString();
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) {
      return null;
    }

    return new ObjectId(value);
  }

  private getOwnerRepository(): MongoRepository<UserModel> {
    return getDataSource().getMongoRepository(UserModel);
  }

  private getTenantRepository(): MongoRepository<TenantModel> {
    return getDataSource().getMongoRepository(TenantModel);
  }

  private getStudentRepository(): MongoRepository<StudentModel> {
    return getDataSource().getMongoRepository(StudentModel);
  }

  private getPendingOwnerSignupRepository(): MongoRepository<PendingOwnerSignupModel> {
    return getDataSource().getMongoRepository(PendingOwnerSignupModel);
  }

  private getPendingStudentSignupRepository(): MongoRepository<PendingStudentSignupModel> {
    return getDataSource().getMongoRepository(PendingStudentSignupModel);
  }

  private getAuthSessionRepository(): MongoRepository<AuthSessionModel> {
    return getDataSource().getMongoRepository(AuthSessionModel);
  }
  public async updateOwnerPassword(ownerId: string, hashedPassword: string): Promise<void> {
  const objectId = this.tryParseObjectId(ownerId);
  if (!objectId) return;

  const repo = this.getOwnerRepository();
  const owner = await repo.findOneById(objectId);
  if (!owner) return;

  owner.password = hashedPassword;
  await repo.save(owner);
}

public async updateStudentPassword(studentId: string, hashedPassword: string): Promise<void> {
  const objectId = this.tryParseObjectId(studentId);
  if (!objectId) return

  const repo = this.getStudentRepository();
  const student = await repo.findOneById(objectId);
  if (!student) return;

  student.password = hashedPassword;
  await repo.save(student);
}
}
