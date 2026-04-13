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

export type LibrarySlotType = (typeof LIBRARY_SLOT_TYPE_ENUM)[number];
export type LibraryFacility = (typeof LIBRARY_FACILITY_ENUM)[number];
