import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

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
}
