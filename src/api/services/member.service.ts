import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import {
  AddMemberRequest,
  ListMembersQueryRequest,
  ListMemberUploadsQueryRequest,
  UpdateMemberRequest,
} from '../controllers/requests/member.request';
import {
  buildMemberUploadReport,
  buildMemberUploadTemplate,
  buildValidatedUploadPayload,
  getMemberUploadErrorMessage,
  MemberUploadFile,
  parseMemberUploadFile,
  resolveMemberBulkUploadStatus,
} from '../helpers/memberUpload.helper';
import { LibraryRepository } from '../repositories/library.repository';
import { LibrarySeatRepository } from '../repositories/librarySeat.repository';
import { MemberInviteLinkRepository } from '../repositories/memberInviteLink.repository';
import { MemberRepository } from '../repositories/member.repository';
import { MemberBulkUploadRepository } from '../repositories/memberBulkUpload.repository';
import { MemberInviteLinkRecord } from '../repositories/types/memberInviteLink.repository.types';
import { MemberMsgResponse, MemberRecord } from '../repositories/types/member.repository.types';
import { MemberBulkUploadRecord } from '../repositories/types/memberBulkUpload.repository.types';

export type ListMembersResult = {
  members: MemberRecord[];
  page: number;
  limit: number;
  total: number;
};

export type ListMemberUploadsResult = {
  uploads: MemberBulkUploadRecord[];
  page: number;
  limit: number;
  total: number;
};

@Service()
export class MemberService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly memberRepository: MemberRepository,
    private readonly memberBulkUploadRepository: MemberBulkUploadRepository,
    private readonly memberInviteLinkRepository: MemberInviteLinkRepository,
    private readonly librarySeatRepository: LibrarySeatRepository,
  ) {}

  public async addMember(ownerId: string, payload: AddMemberRequest): Promise<MemberMsgResponse> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      await this.createMemberForLibrary(library.id, payload);

      return {
        msg: 'Member added successfully',
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('MEMBER_CREATION_FAILED');
    }
  }

  public async listMembers(
    ownerId: string,
    query: ListMembersQueryRequest,
  ): Promise<ListMembersResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const result = await this.memberRepository.listMembersByLibrary({
        libraryId: library.id,
        page,
        limit,
        search: query.search?.trim() || undefined,
        status: query.status as 'active' | 'inactive' | 'expired' | 'pending' | undefined,
        slotId: query.slotId?.trim() || undefined,
      });

      return {
        members: result.members,
        page,
        limit,
        total: result.total,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('LIST_MEMBERS_FAILED');
    }
  }

  public async getMemberById(ownerId: string, memberId: string): Promise<MemberRecord> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const member = await this.memberRepository.findMemberByIdAndLibrary(
        memberId.trim(),
        library.id,
      );
      if (!member) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      return member;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_MEMBER_FAILED');
    }
  }

  public async updateMember(
    ownerId: string,
    memberId: string,
    payload: UpdateMemberRequest,
  ): Promise<MemberRecord> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const existingMember = await this.memberRepository.findMemberByIdAndLibrary(
        memberId.trim(),
        library.id,
      );
      if (!existingMember) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      const mobileNo = payload.mobileNo?.trim();
      const aadharId = payload.aadharId?.trim();
      if (mobileNo || aadharId) {
        const duplicateMember = await this.memberRepository.findMemberByLibraryMobileOrAadhar(
          library.id,
          mobileNo,
          aadharId,
          existingMember.id,
        );
        if (duplicateMember) {
          throw new HttpError(409, 'MEMBER_ALREADY_EXISTS');
        }
      }

      const newSeatId =
        payload.seatId === undefined ? existingMember.seatId : payload.seatId?.trim() || null;
      const newSlotId =
        payload.slotId === undefined ? existingMember.slotId : payload.slotId?.trim() || null;
      if (
        newSeatId &&
        (newSeatId !== existingMember.seatId || newSlotId !== existingMember.slotId)
      ) {
        const seatConflict = await this.memberRepository.findActiveMemberBySeat(
          library.id,
          newSeatId,
          newSlotId || undefined,
          existingMember.id,
        );
        if (seatConflict) {
          throw new HttpError(409, 'SEAT_ALREADY_ASSIGNED');
        }
      }

      const nextDuration = payload.duration ?? existingMember.duration;
      const nextStartDate = payload.startDate ?? existingMember.startDate;
      if (payload.startDate) {
        this.assertValidIsoDate(payload.startDate);
      }
      if (payload.endDate) {
        this.assertValidIsoDate(payload.endDate);
      }

      const resolvedEndDate =
        payload.endDate ??
        (payload.duration !== undefined || payload.startDate !== undefined
          ? this.addMonthsIsoDate(
              nextStartDate || new Date().toISOString().slice(0, 10),
              nextDuration,
            )
          : existingMember.endDate);

      const updatedMember = await this.memberRepository.updateMemberByIdAndLibrary(
        existingMember.id,
        library.id,
        {
          fullName: payload.fullName?.trim(),
          mobileNo,
          aadharId,
          email: payload.email === undefined ? undefined : payload.email?.trim() || null,
          duration: payload.duration,
          seatId: payload.seatId === undefined ? undefined : payload.seatId.trim() || null,
          slotId: payload.slotId === undefined ? undefined : payload.slotId.trim() || null,
          status: payload.status,
          planAmount: payload.planAmount === undefined ? undefined : Number(payload.planAmount),
          startDate: payload.startDate,
          endDate: resolvedEndDate,
          notes: payload.notes === undefined ? undefined : payload.notes.trim() || null,
          updatedAt: new Date(),
        },
      );

      if (!updatedMember) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      return updatedMember;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('UPDATE_MEMBER_FAILED');
    }
  }

  public async deleteMember(ownerId: string, memberId: string): Promise<MemberMsgResponse> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const deleted = await this.memberRepository.deleteMemberByIdAndLibrary(
        memberId.trim(),
        library.id,
      );
      if (!deleted) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      return { msg: 'Member removed successfully' };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('DELETE_MEMBER_FAILED');
    }
  }

  public async downloadMemberTemplate(): Promise<{ filename: string; buffer: Buffer }> {
    const buffer = await buildMemberUploadTemplate();

    return {
      filename: 'members-upload-template.xlsx',
      buffer,
    };
  }

  public async uploadMembersExcel(
    ownerId: string,
    file: MemberUploadFile,
  ): Promise<MemberBulkUploadRecord> {
    try {
      if (!file?.buffer?.length) {
        throw new HttpError(400, 'UPLOAD_FILE_REQUIRED');
      }

      const isCSV = file.originalname.toLowerCase().endsWith('.csv');
      const isXLSX = file.originalname.toLowerCase().endsWith('.xlsx');

      if (!isCSV && !isXLSX) {
        throw new HttpError(400, 'UPLOAD_FILE_MUST_BE_CSV_OR_XLSX');
      }

      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const parsedRows = await parseMemberUploadFile(file);
      const results = [];
      let successCount = 0;

      for (const row of parsedRows) {
        try {
          const payload = await buildValidatedUploadPayload(row);
          const member = await this.createMemberForLibrary(library.id, payload);
          successCount += 1;
          results.push({
            rowNumber: row.rowNumber,
            fullName: row.fullName,
            mobileNo: row.mobileNo,
            aadharId: row.aadharId,
            email: row.email,
            duration: row.duration,
            seatId: row.seatId,
            slotId: row.slotId,
            statusValue: row.status,
            planAmount: row.planAmount,
            startDate: row.startDate,
            endDate: row.endDate,
            notes: row.notes,
            uploadStatus: 'success' as const,
            errorMessage: null,
            memberId: member.id,
          });
        } catch (error) {
          results.push({
            rowNumber: row.rowNumber,
            fullName: row.fullName,
            mobileNo: row.mobileNo,
            aadharId: row.aadharId,
            email: row.email,
            duration: row.duration,
            seatId: row.seatId,
            slotId: row.slotId,
            statusValue: row.status,
            planAmount: row.planAmount,
            startDate: row.startDate,
            endDate: row.endDate,
            notes: row.notes,
            uploadStatus: 'failed' as const,
            errorMessage: getMemberUploadErrorMessage(error),
            memberId: null,
          });
        }
      }

      const failedCount = results.length - successCount;
      const status = resolveMemberBulkUploadStatus(successCount, failedCount);

      return await this.memberBulkUploadRepository.createUpload({
        ownerId,
        libraryId: library.id,
        fileName: file.originalname,
        status,
        totalRows: results.length,
        successCount,
        failedCount,
        rows: results,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('MEMBER_BULK_UPLOAD_FAILED');
    }
  }

  public async listMemberUploads(
    ownerId: string,
    query: ListMemberUploadsQueryRequest,
  ): Promise<ListMemberUploadsResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const result = await this.memberBulkUploadRepository.listUploadsByLibrary({
        libraryId: library.id,
        page,
        limit,
        status: query.status,
      });

      return {
        uploads: result.uploads,
        page,
        limit,
        total: result.total,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('LIST_MEMBER_UPLOADS_FAILED');
    }
  }

  public async downloadMemberUploadReport(
    ownerId: string,
    uploadId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const upload = await this.memberBulkUploadRepository.findUploadByIdAndLibrary(
        uploadId.trim(),
        library.id,
      );
      if (!upload) {
        throw new NotFoundError('MEMBER_UPLOAD_NOT_FOUND');
      }

      const buffer = await buildMemberUploadReport(upload.rows);
      return {
        filename: `members-upload-report-${upload.id}.xlsx`,
        buffer,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('DOWNLOAD_MEMBER_UPLOAD_REPORT_FAILED');
    }
  }

  public async generateMemberInviteLink(
    ownerId: string,
    siteLibraryId: string,
  ): Promise<MemberInviteLinkRecord> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const token = uuidv4();

      return await this.memberInviteLinkRepository.createInviteLink({
        ownerId,
        libraryId: library.id,
        siteLibraryId,
        token,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GENERATE_MEMBER_INVITE_LINK_FAILED');
    }
  }

  public async getInviteLinkDetails(token: string): Promise<MemberInviteLinkRecord | null> {
    try {
      return await this.memberInviteLinkRepository.findValidLinkByToken(token);
    } catch (error) {
      throw new InternalServerError('GET_INVITE_LINK_DETAILS_FAILED');
    }
  }

  public async submitMemberViaInviteLink(
    token: string,
    payload: AddMemberRequest,
  ): Promise<MemberRecord> {
    try {
      const inviteLink = await this.memberInviteLinkRepository.findValidLinkByToken(token);
      if (!inviteLink) {
        throw new HttpError(404, 'INVITE_LINK_INVALID_OR_EXPIRED');
      }

      const member = await this.createMemberForLibrary(inviteLink.libraryId, payload);

      await this.memberInviteLinkRepository.markLinkAsUsed(token, member.id);

      return member;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('SUBMIT_MEMBER_VIA_INVITE_LINK_FAILED');
    }
  }

  private async createMemberForLibrary(
    libraryId: string,
    payload: AddMemberRequest,
  ): Promise<MemberRecord> {
    const fullName = payload.fullName.trim();
    const mobileNo = payload.mobileNo.trim();
    const aadharId = payload.aadharId?.trim() ?? null;
    const email = payload.email?.trim() ?? null;
    const seatId = payload.seatId?.trim() ?? null;
    const slotId = payload.slotId?.trim() ?? null;
    const status = payload.status || 'active';
    const startDate = payload.startDate || new Date().toISOString().slice(0, 10);
    this.assertValidIsoDate(startDate);
    const endDate = payload.endDate || this.addMonthsIsoDate(startDate, payload.duration);
    this.assertValidIsoDate(endDate);
    const notes = payload.notes?.trim() ?? null;
    const planAmount = typeof payload.planAmount === 'number' ? Number(payload.planAmount) : null;

    const existingMember = await this.memberRepository.findMemberByLibraryMobileOrAadhar(
      libraryId,
      mobileNo,
      aadharId || undefined,
    );
    if (existingMember) {
      throw new HttpError(409, 'MEMBER_ALREADY_EXISTS');
    }

    if (seatId) {
      const validSeat = await this.librarySeatRepository.findSeatByLibraryAndSeatId(
        libraryId,
        seatId,
      );
      if (!validSeat) {
        throw new HttpError(400, 'SEAT_NOT_FOUND');
      }

      const seatConflict = await this.memberRepository.findActiveMemberBySeat(
        libraryId,
        seatId,
        slotId || undefined,
      );
      if (seatConflict) {
        throw new HttpError(409, 'SEAT_ALREADY_ASSIGNED');
      }
    }

    const member = await this.memberRepository.createMember({
      fullName,
      mobileNo,
      aadharId,
      studentId: null,
      email,
      duration: payload.duration,
      libraryId,
      seatId,
      slotId,
      status,
      planAmount,
      startDate,
      endDate,
      notes,
    });
    if (!member) {
      throw new InternalServerError('MEMBER_CREATION_FAILED');
    }

    return member;
  }

  private async getOwnerLibraryOrThrow(ownerId: string) {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    return library;
  }

  private assertValidIsoDate(isoDate: string): void {
    const parsedDate = new Date(`${isoDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new HttpError(400, 'INVALID_DATE');
    }

    if (parsedDate.toISOString().slice(0, 10) !== isoDate) {
      throw new HttpError(400, 'INVALID_DATE');
    }
  }

  private addMonthsIsoDate(isoDate: string, monthsToAdd: number): string {
    this.assertValidIsoDate(isoDate);
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + monthsToAdd);
    return date.toISOString().slice(0, 10);
  }
}
