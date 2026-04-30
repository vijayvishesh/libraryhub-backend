import { LibrarySeating } from '../models/library.model';

export type SeatGender = 'any' | 'male' | 'female';
export type StudentGender = 'male' | 'female' | 'other';

export type SeatStatus = 'available' | 'pending' | 'occupied';

export type SeatMapItem = {
  id: string;
  label: string;
  gender: SeatGender;
  occupied: boolean;
  seatStatus: SeatStatus;
  sectionId: string | null;
};

export const buildSeatMap = (
  seating: LibrarySeating | undefined,
  totalSeats: number,
  seatStatusMap: Map<string, SeatStatus>,
  sectionId?: string,
): SeatMapItem[] => {
  if (seating?.mode === 'section' && seating.sections && seating.sections.length > 0) {
    return buildSectionSeatMap(seating, seatStatusMap, sectionId);
  }

  return buildGeneralSeatMap(seating, totalSeats, seatStatusMap);
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
  seatStatusMap: Map<string, SeatStatus>,
): SeatMapItem[] => {
  const resolvedTotal = Math.max(
    1,
    Number.isFinite(seating?.total) && (seating?.total || 0) > 0 ? seating?.total || 1 : totalSeats,
  );

  return Array.from({ length: resolvedTotal }).map((_, index) => {
    const seatNumber = index + 1;
    const label = String(seatNumber);
    const status = seatStatusMap.get(label) || 'available';
    return {
      id: label,
      label,
      gender: resolveGeneralSeatGender(seatNumber, seating),
      occupied: status !== 'available',
      seatStatus: status,
      sectionId: null,
    };
  });
};

const buildSectionSeatMap = (
  seating: LibrarySeating,
  seatStatusMap: Map<string, SeatStatus>,
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
      const status = seatStatusMap.get(label) || 'available';
      seatItems.push({
        id: label,
        label,
        gender: section.gender,
        occupied: status !== 'available',
        seatStatus: status,
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
