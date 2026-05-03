import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { LibrarySeatModel } from '../models/librarySeat.model';
import { CreateLibrarySeatInput, LibrarySeatRecord } from './types/librarySeat.repository.types';

type WithObjectId = {
  id: ObjectId;
};

@Service()
export class LibrarySeatRepository {
  private indexesEnsured = false;

  public async replaceLibrarySeats(
    libraryId: string,
    seats: CreateLibrarySeatInput[],
  ): Promise<LibrarySeatRecord[]> {
    await this.ensureIndexes();

    const seatRepository = this.getSeatRepository();
    await seatRepository.deleteMany({ libraryId });

    if (seats.length === 0) {
      return [];
    }

    const now = new Date();
    const seatDocs = seats.map(seat =>
      seatRepository.create({
        ...seat,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const savedSeats = await seatRepository.save(seatDocs);
    return savedSeats.map(item => this.mapSeat(item));
  }

  public async countSeatsByLibraryId(libraryId: string): Promise<number> {
    return this.getSeatRepository().countBy({ libraryId, isActive: true });
  }

  public async findSeatsByLibraryId(
    libraryId: string,
    sectionId?: string,
  ): Promise<LibrarySeatRecord[]> {
    const whereFilter: Record<string, unknown> = {
      libraryId,
      isActive: true,
    };

    if (sectionId) {
      whereFilter.sectionId = sectionId;
    }

    const seats = await this.getSeatRepository().find({
      where: whereFilter,
      order: { sequence: 'ASC' },
    });

    return seats.map(item => this.mapSeat(item));
  }

  public async findAllSeatsByLibraryId(libraryId: string): Promise<LibrarySeatRecord[]> {
    const seats = await this.getSeatRepository().find({
      where: { libraryId },
      order: { sequence: 'ASC' },
    });
    return seats.map(item => this.mapSeat(item));
  }

  public async findSeatByLibraryAndSeatId(
    libraryId: string,
    seatId: string,
  ): Promise<LibrarySeatRecord | null> {
    const seat = await this.getSeatRepository().findOneBy({
      libraryId,
      seatId,
      isActive: true,
    });

    if (!seat) {
      return null;
    }

    return this.mapSeat(seat);
  }

  private async ensureIndexes(): Promise<void> {
    if (this.indexesEnsured) {
      return;
    }

    const seatRepository = this.getSeatRepository();
    await Promise.all([
      seatRepository.createCollectionIndex(
        { libraryId: 1, seatId: 1 },
        { unique: true, name: 'idx_library_seats_library_seat_unique' },
      ),
      seatRepository.createCollectionIndex(
        { libraryId: 1, sectionId: 1, isActive: 1 },
        { name: 'idx_library_seats_library_section_active' },
      ),
      seatRepository.createCollectionIndex(
        { libraryId: 1, gender: 1, isActive: 1 },
        { name: 'idx_library_seats_library_gender_active' },
      ),
    ]);

    this.indexesEnsured = true;
  }

  private mapSeat(seat: LibrarySeatModel): LibrarySeatRecord {
    return {
      id: this.toHexString(seat),
      libraryId: seat.libraryId,
      seatId: seat.seatId,
      label: seat.label,
      sectionId: seat.sectionId,
      sectionName: seat.sectionName,
      gender: seat.gender,
      sequence: seat.sequence,
      isActive: seat.isActive,
      createdAt: seat.createdAt,
      updatedAt: seat.updatedAt,
    };
  }

  private toHexString(value: WithObjectId): string {
    return value.id.toHexString();
  }

  private getSeatRepository(): MongoRepository<LibrarySeatModel> {
    return getDataSource().getMongoRepository(LibrarySeatModel);
  }
}
