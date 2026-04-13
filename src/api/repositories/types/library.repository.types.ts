import { LibraryFacility, LibrarySlotType } from '../../constants/library.constants';

export type CreateLibrarySlotInput = {
  slotType: LibrarySlotType;
  name: string;
  startTime: string;
  endTime: string;
  pricePerMonth: number;
  isActive: boolean;
};

export type CreateLibraryPhotoInput = {
  url: string;
  publicId: string | null;
  order: number;
  uploadedAt: Date;
};

export type CreateLibraryStatsInput = {
  totalMembers: number;
  activeMembers: number;
  rating: number;
  reviewCount: number;
};

export type CreateLibraryInput = {
  ownerId: string;
  name: string;
  description: string;
  contactPhone: string;
  contactEmail: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  totalSeats: number;
  facilities: LibraryFacility[];
  slots: CreateLibrarySlotInput[];
  photos: CreateLibraryPhotoInput[];
  isActive: boolean;
  isMarketplaceVisible: boolean;
  isOpen: boolean;
  openingHours: string;
  stats: CreateLibraryStatsInput;
  deletedAt: Date | null;
};

export type LibraryRecord = CreateLibraryInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ListLibrariesQuery = {
  search?: string;
  city?: string;
  page: number;
  limit: number;
};

export type ListLibrariesResult = {
  libraries: LibraryRecord[];
  total: number;
};
