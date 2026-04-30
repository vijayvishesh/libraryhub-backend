export type CreateMemberInviteLinkInput = {
  ownerId: string;
  libraryId: string;
  siteLibraryId: string;
  token: string;
};

export type MemberInviteLinkRecord = CreateMemberInviteLinkInput & {
  id: string;
  isUsed: boolean;
  usedAt?: Date;
  usedByMemberId?: string;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
};
