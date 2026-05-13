import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type LibraryTransferStatus = 'pending_otp' | 'completed' | 'cancelled';

@Entity('library_transfers')
@Index('idx_library_transfers_library_id', ['libraryId'])
@Index('idx_library_transfers_old_owner_id', ['oldOwnerId'])
@Index('idx_library_transfers_status', ['status'])
export class LibraryTransferModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  libraryId!: string;

  @Column()
  oldOwnerId!: string;

  @Column()
  oldOwnerPhone!: string;

  @Column()
  newOwnerName!: string;

  @Column()
  newOwnerPhone!: string;

  @Column()
  newOwnerEmail!: string | null;

  @Column()
  newOwnerPassword!: string;        

  @Column()
  keepLibraryName!: boolean;

  @Column()
  newLibraryName!: string | null;

  @Column()
  notifyStudents!: boolean;

  @Column()
  oldOwnerOtp!: string;

  @Column()
  newOwnerOtp!: string;

  @Column()
  otpExpiresAt!: Date;

  @Column()
  status!: LibraryTransferStatus;

  @Column()
  newOwnerId!: string | null;      // set after completion

  @Column()
  completedAt!: Date | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}