import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('super_admins')
@Index('idx_super_admins_email_unique', ['email'], { unique: true })
export class SuperAdminModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  name!: string;

  @Column()
  email!: string;

  @Column()
  password!: string;

  @Column()
  role!: string;

  @Column()
  isActive!: boolean;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}