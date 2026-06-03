import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type AppOs = 'android' | 'ios';          
export type AppRole = 'STUDENT' | 'OWNER';   

@Entity('app_versions')
@Index('idx_app_versions_platform_role', ['platform', 'role'], { unique: true })
export class AppVersionModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  platform!: AppOs;

  @Column()
  role!: AppRole;

  @Column()
  latestVersion!: string;

  @Column()
  minVersion!: string;

  @Column()
  forceUpdate!: boolean;

  @Column()
  updateMessage!: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}