import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { AppOs, AppRole } from './appVersion.model';

@Entity('device_app_versions')
@Index('idx_device_app_versions_userId_platform', ['userId', 'platform', 'role'], { unique: true })
export class DeviceAppVersionModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  userId!: string;                  // studentId or ownerId

  @Column()
  role!: AppRole;

  @Column()
  platform!: AppOs;

  @Column()
  deviceId!: string;                // unique device identifier

  @Column()
  currentVersion!: string;          // version installed on device

  @Column()
  isUpdated!: boolean;              // true after PATCH called post-update

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}