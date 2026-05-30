export interface LeaveRequestResult {
  id: string;
  memberId: string;
  studentId: string;
  libraryId: string;
  bookingId: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  resolvedAt: Date | null;
  // enriched fields for owner list view
  studentName?: string;
  studentPhone?: string;
  seatId?: string | null;
  slotId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}