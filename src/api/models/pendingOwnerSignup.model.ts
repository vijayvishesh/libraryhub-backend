import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('owner_signup_requests')
@Index('idx_owner_signup_phone_unique', ['phone'], { unique: true })
export class PendingOwnerSignupModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column()
  password!: string;

  @Column()
  libraryName!: string;

  @Column()
  city!: string;

  @Column()
  otp!: string;

  @Column()
  expiresAt!: Date;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
