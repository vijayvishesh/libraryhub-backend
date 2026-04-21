export type CreateLibrarySeatInput = {
  libraryId: string;
  seatId: string;
  label: string;
  sectionId: string | null;
  sectionName: string | null;
  gender: 'any' | 'male' | 'female';
  sequence: number;
  isActive: boolean;
};

export type LibrarySeatRecord = CreateLibrarySeatInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};
