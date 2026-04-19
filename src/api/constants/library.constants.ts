export const LIBRARY_SLOT_TYPE_ENUM = [
  'fullday',
  'halfday',
  'evening',
  'morning',
  'night',
  'custom',
] as const;

export const LIBRARY_FACILITY_ENUM = [
  'wifi',
  'ac',
  'cctv',
  'water',
  'locker',
  'cafe',
  'parking',
  'power_backup',
  'printer',
  'reading_room',
  'washroom',
  'newspaper',
] as const;

export const LIBRARY_SEATING_MODE_ENUM = ['general', 'section'] as const;
export const LIBRARY_SEATING_ARRANGEMENT_ENUM = ['open', 'split', 'custom'] as const;
export const LIBRARY_SEATING_GENDER_MODE_ENUM = ['mixed', 'separate'] as const;
export const LIBRARY_SEATING_GENDER_ENUM = ['any', 'male', 'female'] as const;

export type LibrarySlotType = (typeof LIBRARY_SLOT_TYPE_ENUM)[number];
export type LibraryFacility = (typeof LIBRARY_FACILITY_ENUM)[number];
export type LibrarySeatingMode = (typeof LIBRARY_SEATING_MODE_ENUM)[number];
export type LibrarySeatingArrangement = (typeof LIBRARY_SEATING_ARRANGEMENT_ENUM)[number];
export type LibrarySeatingGenderMode = (typeof LIBRARY_SEATING_GENDER_MODE_ENUM)[number];
export type LibrarySeatingGender = (typeof LIBRARY_SEATING_GENDER_ENUM)[number];
