import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type MemberBulkUploadStatus = 'success' | 'partial_success' | 'failed';
export type MemberBulkUploadRowStatus = 'success' | 'failed';

export type MemberBulkUploadRowResult = {
  rowNumber: number;
  fullName: string | null;
  mobileNo: string | null;
  aadharId: string | null;
  email: string | null;
  duration: number | null;
  seatId: string | null;
  slotId: string | null;
  statusValue: string | null;
  planAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  uploadStatus: MemberBulkUploadRowStatus;
  errorMessage: string | null;
  memberId: string | null;
};

@Entity('member_bulk_uploads')
@Index('idx_member_bulk_uploads_library_created_at', ['libraryId', 'createdAt'])
export class MemberBulkUploadModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  ownerId!: string;

  @Column()
  libraryId!: string;

  @Column()
  fileName!: string;

  @Column()
  status!: MemberBulkUploadStatus;

  @Column()
  totalRows!: number;

  @Column()
  successCount!: number;

  @Column()
  failedCount!: number;

  @Column()
  rows!: MemberBulkUploadRowResult[];

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
