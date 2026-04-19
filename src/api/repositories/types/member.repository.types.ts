export type CreateMemberInput = {
  fullName: string;
  mobileNo: string;
  aadharId: string;
  email: string | null;
  duration: number;
  libraryId: string;
};

export type MemberRecord = CreateMemberInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};


export type MemberMsgResponse = {
  msg: string;
}