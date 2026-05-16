import {
  LibraryPaymentMethod,
  LibrarySeatingArrangement,
  LibrarySeatingGender,
  LibrarySeatingGenderMode,
  LibrarySeatingMode,
  LibrarySlotType,
} from '../../constants/library.constants';

export type CreateLibrarySlotInput = {
  slotType: LibrarySlotType;
  name: string;
  startTime: string;
  endTime: string;
  pricePerMonth: number;
  isActive: boolean;
  plans?: { duration: string; isActive: boolean; discountPercent: number }[];
  trials?: { duration: string; isActive: boolean }[];
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

export type CreateLibraryPaymentMethodConfigInput = {
  type: LibraryPaymentMethod;
  enabled: boolean;
  label: string;
  upiId?: string;
};

export type LibrarySeatingRange = {
  from: number;
  to: number;
  gender: LibrarySeatingGender;
};

export type LibrarySeatingSection = {
  id: number;
  name: string;
  capacity: number;
  filled: number;
  available: number;
  gender: LibrarySeatingGender;
};

export type LibrarySeating = {
  mode: LibrarySeatingMode;
  total: number;
  filled: number;
  available: number;
  arrangement?: LibrarySeatingArrangement;
  boys?: number;
  girls?: number;
  open?: number;
  ranges?: LibrarySeatingRange[];
  genderMode?: LibrarySeatingGenderMode;
  sections?: LibrarySeatingSection[];
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
  facilities: string[];
  slots: CreateLibrarySlotInput[];
  seating?: LibrarySeating;
  photos: CreateLibraryPhotoInput[];
  paymentMethods: CreateLibraryPaymentMethodConfigInput[];
  upiId?: string;
  upiIdGpay?: string;
  isActive: boolean;
  isMarketplaceVisible: boolean;
  isOpen: boolean;
  openingHours: string;
  stats: CreateLibraryStatsInput;
  deletedAt: Date | null;
};

export type UpdateLibraryInput = Partial<Omit<CreateLibraryInput, 'ownerId'>>;

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
  facilities?: string[];
  minRating?: number;
  priceSort?: 'low_to_high' | 'high_to_low';
  ratingSort?: 'top_rated';
};

export type ListLibrariesResult = {
  libraries: LibraryRecord[];
  total: number;
};
