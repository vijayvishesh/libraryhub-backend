import { LibrarySeating } from '../models/library.model';

export type SeatGender = 'any' | 'male' | 'female';
export type StudentGender = 'male' | 'female' | 'other';

export type SeatMapItem = {
  id: string;
  label: string;
  gender: SeatGender;
  occupied: boolean;
  sectionId: string | null;
};

const SEATS_PER_ROW = 50;

export const buildSeatMap = (
  seating: LibrarySeating | undefined,
  totalSeats: number,
  occupiedSeatIds: Set<string>,
  sectionId?: string,
): SeatMapItem[] => {
  if (seating?.mode === 'section' && seating.sections && seating.sections.length > 0) {
    return buildSectionSeatMap(seating, occupiedSeatIds, sectionId);
  }

  return buildGeneralSeatMap(seating, totalSeats, occupiedSeatIds);
};

export const isSeatAllowedForStudent = (
  seatGender: SeatGender,
  studentGender: StudentGender,
): boolean => seatGender === 'any' || seatGender === studentGender;

export const pickAutoSeat = (
  seats: SeatMapItem[],
  studentGender: StudentGender,
): SeatMapItem | null => {
  const available = seats.find(
    item => !item.occupied && isSeatAllowedForStudent(item.gender, studentGender),
  );

  return available || null;
};

const buildGeneralSeatMap = (
  seating: LibrarySeating | undefined,
  totalSeats: number,
  occupiedSeatIds: Set<string>,
): SeatMapItem[] => {
  const resolvedTotal = Math.max(
    1,
    Number.isFinite(seating?.total) && (seating?.total || 0) > 0 ? seating?.total || 1 : totalSeats,
  );

  return Array.from({ length: resolvedTotal }).map((_, index) => {
    const seatNumber = index + 1;
    const label = formatSeatLabel(seatNumber);
    return {
      id: label,
      label,
      gender: resolveGeneralSeatGender(seatNumber, seating),
      occupied: occupiedSeatIds.has(label),
      sectionId: null,
    };
  });
};

const buildSectionSeatMap = (
  seating: LibrarySeating,
  occupiedSeatIds: Set<string>,
  sectionId?: string,
): SeatMapItem[] => {
  const filteredSections = sectionId
    ? seating.sections?.filter(section => String(section.id) === sectionId)
    : seating.sections;

  if (!filteredSections || filteredSections.length === 0) {
    return [];
  }

  const seatItems: SeatMapItem[] = [];
  filteredSections.forEach(section => {
    const capacity = Math.max(0, section.capacity || 0);
    for (let index = 1; index <= capacity; index += 1) {
      const label = `SEC-${section.id}-${String(index).padStart(2, '0')}`;
      seatItems.push({
        id: label,
        label,
        gender: section.gender,
        occupied: occupiedSeatIds.has(label),
        sectionId: String(section.id),
      });
    }
  });

  return seatItems;
};

const resolveGeneralSeatGender = (seatNumber: number, seating?: LibrarySeating): SeatGender => {
  if (!seating || seating.mode !== 'general') {
    return 'any';
  }

  const arrangement = seating.arrangement || 'open';
  if (arrangement === 'open') {
    return 'any';
  }

  if (arrangement === 'split') {
    const boysCount = Math.max(0, seating.boys || 0);
    const girlsCount = Math.max(0, seating.girls || 0);

    if (seatNumber <= boysCount) {
      return 'male';
    }

    if (seatNumber <= boysCount + girlsCount) {
      return 'female';
    }

    return 'any';
  }

  const matchedRange = seating.ranges?.find(
    range => seatNumber >= range.from && seatNumber <= range.to,
  );
  return matchedRange?.gender || 'any';
};

const formatSeatLabel = (seatNumber: number): string => {
  const zeroBased = seatNumber - 1;
  const rowIndex = Math.floor(zeroBased / SEATS_PER_ROW);
  const positionInRow = (zeroBased % SEATS_PER_ROW) + 1;

  return `${toAlphabetLabel(rowIndex)}-${String(positionInRow).padStart(2, '0')}`;
};

const toAlphabetLabel = (index: number): string => {
  let current = index + 1;
  let label = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
};
