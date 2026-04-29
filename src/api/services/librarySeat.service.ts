import { Service } from 'typedi';
import { buildSeatMap, SeatMapItem } from '../helpers/seatMap.helper';
import { LibraryRepository } from '../repositories/library.repository';
import { LibrarySeatRepository } from '../repositories/librarySeat.repository';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import {
  CreateLibrarySeatInput,
  LibrarySeatRecord,
} from '../repositories/types/librarySeat.repository.types';
import { SeatBackfillResult } from './types/librarySeat.service.types';

export type { SeatBackfillResult };

@Service()
export class LibrarySeatService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly librarySeatRepository: LibrarySeatRepository,
  ) {}

  public async syncLibrarySeatsFromLibrary(library: LibraryRecord): Promise<LibrarySeatRecord[]> {
    const generatedSeats = this.generateSeatInventory(library);
    return this.librarySeatRepository.replaceLibrarySeats(library.id, generatedSeats);
  }

  public async ensureLibrarySeatInventory(library: LibraryRecord): Promise<void> {
    const seatsCount = await this.librarySeatRepository.countSeatsByLibraryId(library.id);
    if (seatsCount > 0) {
      return;
    }

    await this.syncLibrarySeatsFromLibrary(library);
  }

  public async listLibrarySeats(
    libraryId: string,
    sectionId?: string,
  ): Promise<LibrarySeatRecord[]> {
    return this.librarySeatRepository.findSeatsByLibraryId(libraryId, sectionId);
  }

  public async findLibrarySeat(
    libraryId: string,
    seatId: string,
  ): Promise<LibrarySeatRecord | null> {
    return this.librarySeatRepository.findSeatByLibraryAndSeatId(libraryId, seatId);
  }

  public async backfillMissingLibrarySeats(): Promise<SeatBackfillResult> {
    const libraries = await this.libraryRepository.findAllLibraries();
    let backfilledLibraries = 0;

    for (const library of libraries) {
      const seatsCount = await this.librarySeatRepository.countSeatsByLibraryId(library.id);
      if (seatsCount > 0) {
        continue;
      }

      await this.syncLibrarySeatsFromLibrary(library);
      backfilledLibraries += 1;
    }

    return {
      totalLibraries: libraries.length,
      backfilledLibraries,
      skippedLibraries: libraries.length - backfilledLibraries,
    };
  }

  private generateSeatInventory(library: LibraryRecord): CreateLibrarySeatInput[] {
    const sectionsById = new Map(
      (library.seating?.sections || []).map(section => [String(section.id), section.name]),
    );

    const generatedSeatMap = buildSeatMap(library.seating, library.totalSeats, new Map());
    return generatedSeatMap.map((seat, index) =>
      this.mapSeatToInventoryRecord(library.id, seat, index + 1, sectionsById),
    );
  }

  private mapSeatToInventoryRecord(
    libraryId: string,
    seat: SeatMapItem,
    sequence: number,
    sectionsById: Map<string, string>,
  ): CreateLibrarySeatInput {
    return {
      libraryId,
      seatId: seat.id,
      label: seat.label,
      sectionId: seat.sectionId,
      sectionName: seat.sectionId ? sectionsById.get(seat.sectionId) || null : null,
      gender: seat.gender,
      sequence,
      isActive: true,
    };
  }
}
