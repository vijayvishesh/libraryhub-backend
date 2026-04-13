import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('owners')
@Index('idx_owners_phone_unique', ['phone'], { unique: true })
export class UserModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  tenantId!: string;

  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column()
  password!: string;

  @Column()
  hasCreatedLibrary!: boolean;

  @Column()
  role!: string;
}
