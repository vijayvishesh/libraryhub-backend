import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { AddMemberRequest } from '../controllers/requests/member.request';
import { LibraryRepository } from '../repositories/library.repository';
import { MemberRepository } from '../repositories/member.repository';
import { MemberMsgResponse } from '../repositories/types/member.repository.types';

@Service()
export class MemberService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly memberRepository: MemberRepository,
  ) {}

  public async addMember(ownerId: string, payload: AddMemberRequest): Promise<MemberMsgResponse> {
    try {
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
      if (!library) {
        throw new NotFoundError('LIBRARY_NOT_FOUND');
      }

      const existingMember = await this.memberRepository.findMemberByLibraryMobileOrAadhar(
        library.id,
        payload.mobileNo,
        payload.aadharId,
      );

      if (existingMember) {
        throw new HttpError(409, 'MEMBER_ALREADY_EXISTS');
      }

      const member = await this.memberRepository.createMember({
        fullName: payload.fullName.trim(),
        mobileNo: payload.mobileNo.trim(),
        aadharId: payload.aadharId.trim(),
        email: payload.email?.trim() ?? null,
        duration: payload.duration,
        libraryId: library.id,
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
}
