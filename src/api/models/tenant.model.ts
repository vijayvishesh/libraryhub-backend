import { ObjectId } from 'mongodb';
import { Column, Entity, ObjectIdColumn } from 'typeorm';

@Entity('tenants')
export class TenantModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  name!: string;

  @Column()
  ownerId!: string;

  @Column()
  city!: string;

  @Column()
  isSetupCompleted!: boolean;
}
