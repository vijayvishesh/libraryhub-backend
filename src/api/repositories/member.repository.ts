import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberModel } from '../models/member.model';
import {
  CreateMemberInput,
  ListMembersQuery,
  ListMembersResult,
  MemberRecord,
  UpdateMemberInput,
} from './types/member.repository.types';

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
    mobileNo?: string,
    aadharId?: string,
    excludeMemberId?: string,
  ): Promise<MemberRecord | null> {
    const orFilters: Array<Record<string, string>> = [];
    if (mobileNo) {
      orFilters.push({ mobileNo });
    }

    if (aadharId) {
      orFilters.push({ aadharId });
    }

    if (orFilters.length === 0) {
      return null;
    }

    const members = await this.getMemberRepository().find({
      where: {
        libraryId,
        $or: orFilters,
      },
      order: { createdAt: 'DESC' },
    });
    const member = members.find(item => {
      if (!excludeMemberId) {
        return true;
      }

      return item.id.toHexString() !== excludeMemberId;
    });

    if (!member) {
      return null;
    }

    return this.mapMember(member);
  }

  public async listMembersByLibrary(query: ListMembersQuery): Promise<ListMembersResult> {
    const memberRepository = this.getMemberRepository();
    const filter: Record<string, unknown> = {
      libraryId: query.libraryId,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.slotId) {
      filter.slotId = query.slotId;
    }

    if (query.search) {
      const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = { $regex: escapedSearch, $options: 'i' };
      filter.$or = [{ fullName: searchRegex }, { mobileNo: searchRegex }, { email: searchRegex }];
    }

    const [members, total] = await Promise.all([
      memberRepository.find({
        where: filter,
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      memberRepository.count({ where: filter }),
    ]);

    return {
      members: members.map(item => this.mapMember(item)),
      total,
    };
  }

  public async findAllMembersByLibrary(libraryId: string): Promise<MemberRecord[]> {
    const members = await this.getMemberRepository().find({
      where: { libraryId },
      order: { createdAt: 'DESC' },
    });

    return members.map(item => this.mapMember(item));
  }

  public async findMemberByIdAndLibrary(
    memberId: string,
    libraryId: string,
  ): Promise<MemberRecord | null> {
    const objectId = this.tryParseObjectId(memberId);
    if (!objectId) {
      return null;
    }

    const member = await this.getMemberRepository().findOneById(objectId);
    if (!member || member.libraryId !== libraryId) {
      return null;
    }

    return this.mapMember(member);
  }

  public async updateMemberByIdAndLibrary(
    memberId: string,
    libraryId: string,
    input: UpdateMemberInput,
  ): Promise<MemberRecord | null> {
    const objectId = this.tryParseObjectId(memberId);
    if (!objectId) {
      return null;
    }

    const memberRepository = this.getMemberRepository();
    const member = await memberRepository.findOneById(objectId);
    if (!member || member.libraryId !== libraryId) {
      return null;
    }

    if (input.fullName !== undefined) {
      member.fullName = input.fullName;
    }
    if (input.mobileNo !== undefined) {
      member.mobileNo = input.mobileNo;
    }
    if (input.aadharId !== undefined) {
      member.aadharId = input.aadharId;
    }
    if (input.email !== undefined) {
      member.email = input.email;
    }
    if (input.duration !== undefined) {
      member.duration = input.duration;
    }
    if (input.seatId !== undefined) {
      member.seatId = input.seatId;
    }
    if (input.slotId !== undefined) {
      member.slotId = input.slotId;
    }
    if (input.status !== undefined) {
      member.status = input.status;
    }
    if (input.planAmount !== undefined) {
      member.planAmount = input.planAmount;
    }
    if (input.startDate !== undefined) {
      member.startDate = input.startDate;
    }
    if (input.endDate !== undefined) {
      member.endDate = input.endDate;
    }
    if (input.notes !== undefined) {
      member.notes = input.notes;
    }

    member.updatedAt = input.updatedAt || new Date();
    const savedMember = await memberRepository.save(member);
    return this.mapMember(savedMember);
  }

  public async deleteMemberByIdAndLibrary(memberId: string, libraryId: string): Promise<boolean> {
    const objectId = this.tryParseObjectId(memberId);
    if (!objectId) {
      return false;
    }

    const memberRepository = this.getMemberRepository();
    const member = await memberRepository.findOneById(objectId);
    if (!member || member.libraryId !== libraryId) {
      return false;
    }

    await memberRepository.delete(objectId);
    return true;
  }

  public async findMemberByStudentIdAndLibrary(
    studentId: string,
    libraryId: string,
  ): Promise<MemberRecord | null> {
    const member = await this.getMemberRepository().findOneBy({
      studentId,
      libraryId,
    });

    if (!member) {
      return null;
    }

    return this.mapMember(member);
  }

  public async findActiveMemberSeatIds(
    libraryId: string,
    slotId?: string,
    sectionId?: string,
  ): Promise<string[]> {
    const whereFilter: Record<string, unknown> = {
      libraryId,
      status: { $in: ['active', 'pending'] },
      seatId: { $ne: null },
    };

    if (slotId) {
      whereFilter.slotId = slotId;
    }

    const members = await this.getMemberRepository().find({ where: whereFilter });

    let seatIds = members.map(m => m.seatId).filter((id): id is string => id !== null);

    if (sectionId) {
      const prefix = `SEC-${sectionId}-`;
      seatIds = seatIds.filter(id => id.startsWith(prefix));
    }

    return seatIds;
  }

  public async findActiveMemberBySeat(
    libraryId: string,
    seatId: string,
    slotId?: string,
    excludeMemberId?: string,
  ): Promise<MemberRecord | null> {
    const whereFilter: Record<string, unknown> = {
      libraryId,
      seatId,
      status: { $in: ['active', 'pending'] },
    };

    if (slotId) {
      whereFilter.slotId = slotId;
    }

    if (excludeMemberId) {
      const objectId = this.tryParseObjectId(excludeMemberId);
      if (objectId) {
        whereFilter['_id'] = { $ne: objectId };
      }
    }

    const member = await this.getMemberRepository().findOneBy(whereFilter);
    return member ? this.mapMember(member) : null;
  }

  private async ensureIndexes(): Promise<void> {
    if (this.indexesEnsured) {
      return;
    }

    await this.createIndexSafely(
      { libraryId: 1, mobileNo: 1 },
      { unique: true, name: 'idx_members_library_mobile_unique' },
    );
    await this.createIndexSafely(
      { libraryId: 1, aadharId: 1 },
      { unique: true, sparse: true, name: 'idx_members_library_aadhar_unique' },
    );
    await this.createIndexSafely(
      { libraryId: 1, studentId: 1 },
      { sparse: true, name: 'idx_members_library_student' },
    );
    await this.createIndexSafely(
      { libraryId: 1, status: 1, createdAt: -1 },
      { name: 'idx_members_library_status_created_at' },
    );

    this.indexesEnsured = true;
  }

  private async createIndexSafely(
    keys: Record<string, 1 | -1>,
    options: { name: string; unique?: boolean; sparse?: boolean },
  ): Promise<void> {
    try {
      await this.getMemberRepository().createCollectionIndex(keys, options);
    } catch (error) {
      if (this.isIgnorableIndexError(error)) {
        return;
      }

      throw error;
    }
  }

  private isIgnorableIndexError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const errWithCode = error as { code?: number; message?: string };
    const message = (errWithCode.message || '').toLowerCase();

    if (errWithCode.code === 85 || errWithCode.code === 86) {
      return true;
    }

    return (
      message.includes('already exists') ||
      message.includes('index options conflict') ||
      message.includes('index key specs conflict')
    );
  }

  private mapMember(member: MemberModel): MemberRecord {
    return {
      id: member.id.toHexString(),
      fullName: member.fullName,
      mobileNo: member.mobileNo,
      aadharId: member.aadharId ?? null,
      studentId: member.studentId ?? null,
      email: member.email,
      duration: member.duration,
      libraryId: member.libraryId,
      seatId: member.seatId ?? null,
      slotId: member.slotId ?? null,
      status: member.status || 'active',
      planAmount: member.planAmount ?? null,
      startDate: member.startDate ?? null,
      endDate: member.endDate ?? null,
      notes: member.notes ?? null,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) {
      return null;
    }

    return new ObjectId(value);
  }

  private getMemberRepository(): MongoRepository<MemberModel> {
    return getDataSource().getMongoRepository(MemberModel);
  }
}
