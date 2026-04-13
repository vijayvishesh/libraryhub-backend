import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('auth_sessions')
@Index('idx_auth_sessions_owner_id', ['ownerId'])
@Index('idx_auth_sessions_tenant_id', ['tenantId'])
@Index('idx_auth_sessions_is_revoked', ['isRevoked'])
export class AuthSessionModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  ownerId!: string;

  @Column()
  tenantId!: string;

  @Column()
  role!: string;

  @Column()
  refreshTokenHash!: string;

  @Column()
  isRevoked!: boolean;

  @Column()
  expiresAt!: Date;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @Column()
  lastUsedAt!: Date;
}
