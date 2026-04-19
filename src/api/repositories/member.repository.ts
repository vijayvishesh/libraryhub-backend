import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberModel } from '../models/member.model';
import { CreateMemberInput, MemberRecord } from './types/member.repository.types';

@Service()
export class MemberRepository {
  private indexesEnsured = false;

  public async createMember(input: CreateMemberInput): Promise<MemberRecord> {
    await this.ensureIndexes();

    const memberRepository = this.getMemberRepository();
    const now = new Date();
    const member = memberRepository.create({
      ...input,
      createdAt: now,
      updatedAt: now,
    });

    const savedMember = await memberRepository.save(member);
    return this.mapMember(savedMember);
  }

  public async findMemberByLibraryMobileOrAadhar(
    libraryId: string,
    mobileNo: string,
    aadharId: string,
  ): Promise<MemberRecord | null> {
    const member = await this.getMemberRepository().findOne({
      where: {
        libraryId,
        $or: [{ mobileNo }, { aadharId }],
      },
    });

    if (!member) {
      return null;
    }

    return this.mapMember(member);
  }

  private async ensureIndexes(): Promise<void> {
    if (this.indexesEnsured) {
      return;
    }

    const memberRepository = this.getMemberRepository();
    await Promise.all([
      memberRepository.createCollectionIndex(
        { libraryId: 1, mobileNo: 1 },
        { unique: true, name: 'idx_members_library_mobile_unique' },
      ),
      memberRepository.createCollectionIndex(
        { libraryId: 1, aadharId: 1 },
        { unique: true, name: 'idx_members_library_aadhar_unique' },
      ),
    ]);

    this.indexesEnsured = true;
  }

  private mapMember(member: MemberModel): MemberRecord {
    return {
      id: member.id.toHexString(),
      fullName: member.fullName,
      mobileNo: member.mobileNo,
      aadharId: member.aadharId,
      email: member.email,
      duration: member.duration,
      libraryId: member.libraryId,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }

  private getMemberRepository(): MongoRepository<MemberModel> {
    return getDataSource().getMongoRepository(MemberModel);
  }
}
