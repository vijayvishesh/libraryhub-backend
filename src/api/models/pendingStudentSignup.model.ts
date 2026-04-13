import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('student_signup_requests')
@Index('idx_student_signup_phone_unique', ['phone'], { unique: true })
export class PendingStudentSignupModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column()
  password!: string;

  @Column()
  otp!: string;

  @Column()
  expiresAt!: Date;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
