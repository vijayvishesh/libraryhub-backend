import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type PaymentMethodType = 'cash' | 'qr_code';

export type PaymentMethodConfig = {
  type: PaymentMethodType;
  enabled: boolean;
  label: string;
  qrCodeUrl?: string | null;
};

@Entity('library_payment_methods')
@Index('idx_library_payment_methods_library_id', ['libraryId'], { unique: true })
export class LibraryPaymentMethodModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  libraryId!: string;

  @Column()
  ownerId!: string;

  @Column()
  methods!: PaymentMethodConfig[];

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}