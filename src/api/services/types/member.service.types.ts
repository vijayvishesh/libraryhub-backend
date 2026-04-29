import { MemberRecord } from '../../repositories/types/member.repository.types';

export type ListMembersResult = {
  members: MemberRecord[];
  page: number;
  limit: number;
  total: number;
};
