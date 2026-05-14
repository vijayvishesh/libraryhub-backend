export type LibraryRatingRecord = {
  id: string;
  libraryId: string;
  studentId: string;
  rating: number;
  review: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateLibraryRatingInput = {
  libraryId: string;
  studentId: string;
  rating: number;
  review: string | null;
};
