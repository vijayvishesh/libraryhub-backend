import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type AccountStatus = 'active' | 'deactivated';

@Entity('students')
@Index('idx_students_phone_unique', ['phone'], { unique: true })
export class StudentModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column()
  gender!: 'male' | 'female' | 'other';

  @Column()
  password!: string;

  @Column()
  isPhoneVerified!: boolean;

  @Column()
  hasJoinedLibrary!: boolean;

  @Column()
  role!: string;

  @Column()
  email!: string | null;

  @Column()
  city!: string | null;

  @Column()
  bio!: string | null;

  @Column()
  avatarUrl!: string | null;
  
  @Column()
  accountStatus!: AccountStatus;
}