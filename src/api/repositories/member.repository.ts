import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberModel } from '../models/member.model';
import {
  CreateMemberInput,
  ListInactiveMembersQuery,
  ListInactiveMembersResult,
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
    const { aadharId, isInviteSubmission, ...rest } = input;
    const memberData: Record<string, unknown> = {
      ...rest,
      createdAt: now,
      updatedAt: now,
      isInviteSubmission: isInviteSubmission ?? false,
    };
    // Only set aadharId if it has a value — null would conflict with the unique partial index
    if (aadharId) {
      memberData.aadharId = aadharId;
    }
    const member = memberRepository.create(memberData as Partial<MemberModel>);

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
    libraryId: query.libraryId, // ✅ plain string, not new ObjectId(...)
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

  const studentIds = members
    .map(m => m.studentId)
    .filter((id): id is string => !!id);

  const studentMap = await this.findStudentsByIds(studentIds);

  return {
    members: members.map(item => this.mapMemberWithStudent(item, studentMap)),
    total,
  };
}
  public async findAllMembersByLibrary(libraryId: string): Promise<MemberRecord[]> {
  const members = await this.getMemberRepository().find({
    where: { libraryId },
    order: { createdAt: 'DESC' },
    take: 1000,
  });

  const studentIds = members
    .map(m => m.studentId)
    .filter((id): id is string => !!id);

  const studentMap = await this.findStudentsByIds(studentIds);

  return members.map(item => this.mapMemberWithStudent(item, studentMap));
}

public async findMembersExpiringInRange(
  libraryId: string,
  fromDate: string,
  toDate: string,
): Promise<MemberRecord[]> {
  const members = await this.getMemberRepository().find({
    where: {
      libraryId,
      endDate: { $gte: fromDate, $lte: toDate } as unknown as string,
    },
    order: { endDate: 'ASC' },
  });

  const studentIds = members
    .map(m => m.studentId)
    .filter((id): id is string => !!id);

  const studentMap = await this.findStudentsByIds(studentIds);
  return members.map(item => this.mapMemberWithStudent(item, studentMap));
}

public async findMemberByIdAndLibrary(
  memberId: string,
  libraryId: string,
): Promise<MemberRecord | null> {
  const objectId = this.tryParseObjectId(memberId);
  if (!objectId) return null;

  const member = await this.getMemberRepository().findOneById(objectId);
  if (!member || member.libraryId !== libraryId) return null;

  const studentMap = member.studentId
    ? await this.findStudentsByIds([member.studentId])
    : new Map();

  return this.mapMemberWithStudent(member, studentMap);
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
    if (input.studentId !== undefined) {
      member.studentId = input.studentId;
    }
    if (input.bookingId !== undefined) {
      member.bookingId = input.bookingId;
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
    if (input.paidAt !== undefined) {
      member.paidAt = input.paidAt;
    }
    if (input.isNewUser !== undefined) {
      member.isNewUser = input.isNewUser;
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

  if (!member) return null;

  const studentMap = await this.findStudentsByIds([studentId]);
  return this.mapMemberWithStudent(member, studentMap);
}

  // Slot types that block the seat for ALL other slots
  private readonly FULL_BLOCKING_SLOTS = ['fullday', 'twentyfour'];

  public async findActiveMemberSeatStatus(
    libraryId: string,
    slotId?: string,
    sectionId?: string,
  ): Promise<Map<string, 'pending' | 'occupied'>> {
    const whereFilter: Record<string, unknown> = {
      libraryId,
      status: { $in: ['active', 'pending'] },
      seatId: { $ne: null },
    };

    // Apply the SAME blocking logic as findActiveMemberBySeat
    if (slotId) {
      const isNewBookingFullBlocking = this.FULL_BLOCKING_SLOTS.includes(slotId);
      if (!isNewBookingFullBlocking) {
        // Time-based slot: blocked by fullday/twentyfour OR same slot
        (whereFilter as any).$or = [{ slotId: { $in: this.FULL_BLOCKING_SLOTS } }, { slotId }];
      }
      // If new booking IS fullday/twentyfour: no slotId filter → any active member blocks it
    }

    const members = await this.getMemberRepository().find({ where: whereFilter });

    const statusMap = new Map<string, 'pending' | 'occupied'>();
    for (const member of members) {
      if (!member.seatId) {
        continue;
      }
      if (sectionId) {
        const prefix = `SEC-${sectionId}-`;
        if (!member.seatId.startsWith(prefix)) {
          continue;
        }
      }
      statusMap.set(member.seatId, member.status === 'pending' ? 'pending' : 'occupied');
    }

    return statusMap;
  }

  public async findActiveMemberBySeat(
    libraryId: string,
    seatId: string,
    slotId?: string,
    excludeMemberId?: string,
  ): Promise<MemberRecord | null> {
    const excludeFilter: Record<string, unknown> = {};
    if (excludeMemberId) {
      const objectId = this.tryParseObjectId(excludeMemberId);
      if (objectId) {
        excludeFilter['_id'] = { $ne: objectId };
      }
    }

    const baseFilter: Record<string, unknown> = {
      libraryId,
      seatId,
      status: { $in: ['active', 'pending'] },
      ...excludeFilter,
    };

    const isNewBookingFullBlocking = slotId && this.FULL_BLOCKING_SLOTS.includes(slotId);

    if (!slotId || isNewBookingFullBlocking) {
      // Case 1: No slot specified OR new booking is fullday/twentyfour
      // → check if ANY active member exists for this seat
      const member = await this.getMemberRepository().findOneBy(baseFilter);
      return member ? this.mapMember(member) : null;
    }

    // Case 2: New booking is a time-based slot
    // → blocked if existing booking is fullday/twentyfour OR same slot
    const orConditions = [
      // existing fullday/twentyfour blocks this seat
      { slotId: { $in: this.FULL_BLOCKING_SLOTS } },
      // same slot conflict
      { slotId },
    ];

    const member = await this.getMemberRepository().findOneBy({
      ...baseFilter,
      $or: orConditions,
    } as any);

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
      {
        unique: true,
        sparse: false,
        name: 'idx_members_library_aadhar_unique',
        partialFilterExpression: { aadharId: { $type: 'string' } },
      },
    );
    await this.dropIndexSafely('idx_members_library_aadhar_unique');
    await this.dropIndexSafely('idx_members_library_aadhar_unique_v2');
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
    options: {
      name: string;
      unique?: boolean;
      sparse?: boolean;
      partialFilterExpression?: Record<string, unknown>;
    },
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

  private async dropIndexSafely(indexName: string): Promise<void> {
    try {
      const collection = this.getMemberRepository().manager.getMongoRepository(MemberModel);
      await collection.dropCollectionIndex(indexName);
    } catch {
      // Index may not exist, ignore
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
      bookingId: member.bookingId ?? null,
      paidAt: member.paidAt ?? null,
      notes: member.notes ?? null,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      isInviteSubmission: member.isInviteSubmission ?? false,
      isNewUser: member.isNewUser ?? false,
      paymentMethod:        member.paymentMethod ?? null,       
      paymentScreenshotUrl: member.paymentScreenshotUrl ?? null,
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
 public async findAllMembersByStudentId(studentId: string): Promise<MemberRecord[]> {
  const members = await this.getMemberRepository().find({
    where: { studentId } as any,
    take: 1000,
  });

  const studentMap = await this.findStudentsByIds([studentId]);
  return members.map(item => this.mapMemberWithStudent(item, studentMap));
}

  public async findAllMembersByPhone(mobileNo: string): Promise<MemberRecord[]> {
    const members = await this.getMemberRepository().find({
      where: { mobileNo } as any,
      order: { createdAt: 'DESC' },
      take: 1000,
    });
    return members.map(item => this.mapMember(item));
  }
  public async findStudentsByIds(
  studentIds: string[],
): Promise<Map<string, { name: string; phone: string; email: string | null; gender: string }>> {
  if (studentIds.length === 0) return new Map();

  const studentRepo = getDataSource().getMongoRepository(
    (await import('../models/student.model')).StudentModel,
  );

  const students = await studentRepo.find({
    where: { _id: { $in: studentIds.map(id => new ObjectId(id)) } } as any,
  });

  const map = new Map<string, { name: string; phone: string; email: string | null; gender: string }>();
  for (const s of students) {
    map.set(s.id.toHexString(), {
      name: s.name,
      phone: s.phone,
      email: s.email ?? null,
      gender: s.gender,
    });
  }
  return map;
}

// ── New: maps member and overrides with student data if linked ───────────
private mapMemberWithStudent(
  member: MemberModel,
  studentMap: Map<string, { name: string; phone: string; email: string | null; gender: string }>,
): MemberRecord {
  const base = this.mapMember(member);
  const studentId = member.studentId;

  if (studentId) {
    const student = studentMap.get(studentId);
    if (student) {
      // Student's own data overrides whatever owner typed
      base.fullName = student.name;
      base.mobileNo = student.phone;
      // Only override email if student has set one
      if (student.email) {
        base.email = student.email;
      }
    }
  }

  return base;
}

// public async listInactiveMembers(
//   query: ListInactiveMembersQuery,
// ): Promise<ListInactiveMembersResult> {
//   const memberRepository = this.getMemberRepository();
//   const today = query.todayIso;

//   // Build per-type filters
//   const expiredFilter = { libraryId: new ObjectId(query.libraryId), status: 'expired' };
//   const overdueFilter = {
//     libraryId: new ObjectId(query.libraryId),
//     status: 'active',
//     endDate: { $lte: today } as unknown as string,
//   };
//   const inactiveFilter = { libraryId: new ObjectId(query.libraryId), status: 'inactive' };

//   // Always get counts for all three types (for tab/summary display)
//   const [expiredCount, overdueCount, inactiveCount] = await Promise.all([
//     memberRepository.count({ where: expiredFilter }),
//     memberRepository.count({ where: overdueFilter }),
//     memberRepository.count({ where: inactiveFilter }),
//   ]);

//   // Determine which filter to apply based on requested type
//   let activeFilter: Record<string, unknown>;

//   if (query.type === 'expired') {
//     activeFilter = { ...expiredFilter };
//   } else if (query.type === 'overdue') {
//     activeFilter = { ...overdueFilter };
//   } else if (query.type === 'inactive') {
//     activeFilter = { ...inactiveFilter };
//   } else {
//     // No type filter — return all three combined
//     activeFilter = {
//       libraryId: new ObjectId(query.libraryId),
//       $or: [
//         { status: 'expired' },
//         { status: 'inactive' },
//         { status: 'active', endDate: { $lte: today } },
//       ],
//     };
//   }

//   // Apply search on top of the type filter
//   if (query.search) {
//     const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//     const searchRegex = { $regex: escaped, $options: 'i' };
//     const searchConditions = [
//       { fullName: searchRegex },
//       { mobileNo: searchRegex },
//       { email: searchRegex },
//     ];

//     // Merge search with existing $or safely
//     if (activeFilter.$or) {
//       // Wrap existing $or + new search in $and
//       activeFilter = {
//         libraryId: new ObjectId(query.libraryId),
//         $and: [
//           { $or: activeFilter.$or },
//           { $or: searchConditions },
//         ],
//       };
//     } else {
//       activeFilter.$or = searchConditions;
//     }
//   }

//   const [members, total] = await Promise.all([
//     memberRepository.find({
//       where: activeFilter,
//       order: { updatedAt: 'DESC' },
//       skip: (query.page - 1) * query.limit,
//       take: query.limit,
//     }),
//     memberRepository.count({ where: activeFilter }),
//   ]);

//   // Enrich with student data
//   const studentIds = members
//     .map(m => m.studentId)
//     .filter((id): id is string => !!id);
//   const studentMap = await this.findStudentsByIds(studentIds);

//   const enriched = members.map(m => {
//     const base = this.mapMemberWithStudent(m, studentMap);

//     // Derive the memberType for each record
//     let memberType: 'expired' | 'overdue' | 'inactive';
//     if (m.status === 'inactive') {
//       memberType = 'inactive';
//     } else if (m.status === 'expired') {
//       memberType = 'expired';
//     } else {
//       // status === 'active' but endDate <= today
//       memberType = 'overdue';
//     }

//     return { ...base, memberType };
//   });

//   return { members: enriched, total, expiredCount, overdueCount, inactiveCount };
// }
public async listInactiveMembers(
  query: ListInactiveMembersQuery,
): Promise<ListInactiveMembersResult> {
  const memberRepository = this.getMemberRepository();
  const libraryId = query.libraryId; // ✅ plain string — matches how it's stored in DB
  const today = query.todayIso;

  // ── Count filters ─────────────────────────────────────────────────────
  const expiredFilter = {
    libraryId,
    $or: [{ status: 'expired' }, { status: 'active', endDate: { $lt: today } }],
  };
  const overdueFilter = {
    libraryId,
    status: 'active',
    endDate: { $lte: today },
  };
  const inactiveFilter = {
    libraryId,
    status: 'inactive',
  };

  // ── Always fetch all three counts for tab badges ──────────────────────
  const [expiredCountResult, overdueCountResult, inactiveCountResult] =
    await Promise.all([
      memberRepository.aggregate([{ $match: expiredFilter }, { $count: 'n' }]).toArray(),
      memberRepository.aggregate([{ $match: overdueFilter }, { $count: 'n' }]).toArray(),
      memberRepository.aggregate([{ $match: inactiveFilter }, { $count: 'n' }]).toArray(),
    ]);

  const expiredCount: number = expiredCountResult[0]?.n ?? 0;
  const overdueCount: number = overdueCountResult[0]?.n ?? 0;
  const inactiveCount: number = inactiveCountResult[0]?.n ?? 0;

  // ── Active filter based on requested type ─────────────────────────────
  let activeFilter: Record<string, unknown>;

  if (query.type === 'expired') {
    activeFilter = {
      libraryId,
      $or: [{ status: 'expired' }, { status: 'active', endDate: { $lt: today } }],
    };
  } else if (query.type === 'overdue') {
    activeFilter = {
      libraryId,
      status: 'active',
      endDate: { $lte: today },
    };
  } else if (query.type === 'inactive') {
    activeFilter = {
      libraryId,
      status: 'inactive',
    };
  } else {
    activeFilter = {
      libraryId,
      $or: [
        { status: 'expired' },
        { status: 'inactive' },
        { status: 'active', endDate: { $lte: today } },
      ],
    };
  }

  // ── Merge search on top of type filter ────────────────────────────────
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = { $regex: escaped, $options: 'i' };
    const searchConditions = [
      { fullName: searchRegex },
      { mobileNo: searchRegex },
      { email: searchRegex },
    ];

    if ((activeFilter as any).$or) {
      activeFilter = {
        libraryId,
        $and: [{ $or: (activeFilter as any).$or }, { $or: searchConditions }],
      };
    } else {
      (activeFilter as any).$or = searchConditions;
    }
  }

  const skip = (query.page - 1) * query.limit;

  // ── Paginated fetch + total count ─────────────────────────────────────
  const [rawMembers, totalResult] = await Promise.all([
    memberRepository
      .aggregate([
        { $match: activeFilter },
        { $sort: { updatedAt: -1 } },
        { $skip: skip },
        { $limit: query.limit },
      ])
      .toArray(),
    memberRepository
      .aggregate([{ $match: activeFilter }, { $count: 'n' }])
      .toArray(),
  ]);

  const total: number = totalResult[0]?.n ?? 0;

  // ── Map raw aggregate docs to MemberModel shape ───────────────────────
  const memberModels: MemberModel[] = rawMembers.map((doc: any) => {
    const model = new MemberModel();
    model.id                   = doc._id;
    model.fullName             = doc.fullName;
    model.mobileNo             = doc.mobileNo;
    model.aadharId             = doc.aadharId ?? null;
    model.studentId            = doc.studentId ?? null;
    model.email                = doc.email ?? null;
    model.duration             = doc.duration;
    model.libraryId            = doc.libraryId;
    model.seatId               = doc.seatId ?? null;
    model.slotId               = doc.slotId ?? null;
    model.status               = doc.status;
    model.planAmount           = doc.planAmount ?? null;
    model.startDate            = doc.startDate ?? null;
    model.endDate              = doc.endDate ?? null;
    model.bookingId            = doc.bookingId ?? null;
    model.paidAt               = doc.paidAt ?? null;
    model.notes                = doc.notes ?? null;
    model.createdAt            = doc.createdAt;
    model.updatedAt            = doc.updatedAt;
    model.isInviteSubmission   = doc.isInviteSubmission;
    model.isNewUser            = doc.isNewUser;
    model.paymentMethod        = doc.paymentMethod ?? null;
    model.paymentScreenshotUrl = doc.paymentScreenshotUrl ?? null;
    return model;
  });

  // ── Enrich with student data ──────────────────────────────────────────
  const studentIds = memberModels
    .map(m => m.studentId)
    .filter((id): id is string => !!id);

  const studentMap = await this.findStudentsByIds(studentIds);

  // ── Derive memberType and build final result ──────────────────────────
  const enriched = memberModels.map(m => {
    const base = this.mapMemberWithStudent(m, studentMap);

    let memberType: 'expired' | 'overdue' | 'inactive';
    if (m.status === 'inactive') {
      memberType = 'inactive';
    } else if (m.status === 'expired') {
      memberType = 'expired';
    } else {
      memberType = query.type === 'expired' ? 'expired' : 'overdue';
    }

    return { ...base, memberType };
  });

  return {
    members: enriched,
    total,
    expiredCount,
    overdueCount,
    inactiveCount,
  };
}
}
