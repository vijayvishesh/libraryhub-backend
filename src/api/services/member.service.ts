import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import {
  AddMemberRequest,
  ListMembersQueryRequest,
  UpdateMemberRequest,
} from '../controllers/requests/member.request';
import { LibraryRepository } from '../repositories/library.repository';
import { MemberRepository } from '../repositories/member.repository';
import { MemberMsgResponse, MemberRecord } from '../repositories/types/member.repository.types';

export type ListMembersResult = {
  members: MemberRecord[];
  page: number;
  limit: number;
  total: number;
};

@Service()
export class MemberService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly memberRepository: MemberRepository,
  ) {}

  public async addMember(ownerId: string, payload: AddMemberRequest): Promise<MemberMsgResponse> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
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
        library.id,
        mobileNo,
        aadharId || undefined,
      );

      if (existingMember) {
        throw new HttpError(409, 'MEMBER_ALREADY_EXISTS');
      }

      const member = await this.memberRepository.createMember({
        fullName,
        mobileNo,
        aadharId,
        studentId: null,
        email,
        duration: payload.duration,
        libraryId: library.id,
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
