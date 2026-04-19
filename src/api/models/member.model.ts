import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('members')
@Index('idx_members_library_mobile_unique', ['libraryId', 'mobileNo'], { unique: true })
@Index('idx_members_library_aadhar_unique', ['libraryId', 'aadharId'], { unique: true })
export class MemberModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  fullName!: string;

  @Column()
  mobileNo!: string;

  @Column()
  aadharId!: string;

  @Column()
  email!: string | null;

  @Column()
  duration!: number;

  @Column()
  libraryId!: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
