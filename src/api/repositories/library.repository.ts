/* eslint-disable @typescript-eslint/naming-convention */
import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { LibraryModel } from '../models/library.model';
import {
  CreateLibraryInput,
  CreateLibrarySlotInput,
  LibraryRecord,
  ListLibrariesQuery,
  ListLibrariesResult,
  UpdateLibraryInput,
} from './types/library.repository.types';

type WithObjectId = {
  id: ObjectId;
};

type LibraryGeofenceInput = {
  enabled: boolean;
  radiusMeters: number;
  strictMode: boolean;
  exitAlert: boolean;
};

@Service()
export class LibraryRepository {
  private indexesEnsured = false;

  public async createLibrary(input: CreateLibraryInput): Promise<LibraryRecord> {
    await this.ensureIndexes();

    const libraryRepository = this.getLibraryRepository();
    const now = new Date();
    const library = libraryRepository.create({
      ...input,
      createdAt: now,
      updatedAt: now,
    });

    const savedLibrary = await libraryRepository.save(library);
    return this.mapLibrary(savedLibrary);
  }

  public async findLibraryByOwnerId(ownerId: string): Promise<LibraryRecord | null> {
    const library = await this.getLibraryRepository().findOneBy({ ownerId });
    if (!library) {
      return null;
    }

    return this.mapLibrary(library);
  }

  public async findLibraryById(libraryId: string): Promise<LibraryRecord | null> {
    const objectId = this.tryParseObjectId(libraryId);
    if (!objectId) {
      return null;
    }

    const library = await this.getLibraryRepository().findOneById(objectId);
    if (!library) {
      return null;
    }

    return this.mapLibrary(library);
  }

  public async findAllLibraries(): Promise<LibraryRecord[]> {
    const libraries = await this.getLibraryRepository().find({
      where: { deletedAt: null },
      order: { updatedAt: 'DESC' },
    });

    return libraries.map(library => this.mapLibrary(library));
  }

  public async findListedLibraries(query: ListLibrariesQuery): Promise<ListLibrariesResult> {
    await this.ensureIndexes();

    const libraryRepository = this.getLibraryRepository();
    const filter: Record<string, unknown> = {
      isActive: true,
      isMarketplaceVisible: true,
      deletedAt: null,
    };

    if (query.city) {
      const escapedCity = query.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.city = { $regex: `^${escapedCity}$`, $options: 'i' };
    }

    if (query.search) {
      const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = { $regex: escapedSearch, $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { city: searchRegex },
        { address: searchRegex },
        { contactPhone: searchRegex },
      ];
    }

    if (query.facilities && query.facilities.length > 0) {
      filter.facilities = { $all: query.facilities };
    }

    if (query.minRating !== undefined) {
      filter['stats.rating'] = { $gte: query.minRating };
    }

    let sortOrder: Record<string, unknown> = { updatedAt: 'DESC' };

    if (query.ratingSort === 'top_rated') {
      sortOrder = { 'stats.rating': -1 };
    } else if (query.priceSort === 'low_to_high') {
      sortOrder = { 'slots.0.pricePerMonth': 1 };
    } else if (query.priceSort === 'high_to_low') {
      sortOrder = { 'slots.0.pricePerMonth': -1 };
    }

    const [libraries, total] = await Promise.all([
      libraryRepository.find({
        where: filter,
        order: sortOrder as any,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      libraryRepository.count({ where: filter }),
    ]);

    return {
      libraries: libraries.map(library => this.mapLibrary(library)),
      total,
    };
  }

  public async updateLibrary(
    libraryId: string,
    input: CreateLibraryInput,
  ): Promise<LibraryRecord | null> {
    const objectId = this.tryParseObjectId(libraryId);
    if (!objectId) {
      return null;
    }

    const libraryRepository = this.getLibraryRepository();
    const existingLibrary = await libraryRepository.findOneById(objectId);
    if (!existingLibrary) {
      return null;
    }

    existingLibrary.ownerId = input.ownerId;
    existingLibrary.name = input.name;
    existingLibrary.description = input.description;
    existingLibrary.contactPhone = input.contactPhone;
    existingLibrary.contactEmail = input.contactEmail;
    existingLibrary.address = input.address;
    existingLibrary.city = input.city;
    existingLibrary.state = input.state;
    existingLibrary.pincode = input.pincode;
    existingLibrary.location = input.location;
    existingLibrary.totalSeats = input.totalSeats;
    existingLibrary.seating = input.seating;
    existingLibrary.facilities = input.facilities;
    existingLibrary.slots = input.slots;
    existingLibrary.photos = input.photos;
    existingLibrary.paymentMethods = input.paymentMethods;
    existingLibrary.isActive = input.isActive;
    existingLibrary.isMarketplaceVisible = input.isMarketplaceVisible;
    existingLibrary.isOpen = input.isOpen;
    existingLibrary.openingHours = input.openingHours;
    existingLibrary.stats = input.stats;
    existingLibrary.deletedAt = input.deletedAt;
    existingLibrary.updatedAt = new Date();

    const savedLibrary = await libraryRepository.save(existingLibrary);
    return this.mapLibrary(savedLibrary);
  }

  public async partialUpdateLibrary(
    libraryId: string,
    input: UpdateLibraryInput,
  ): Promise<LibraryRecord | null> {
    const objectId = this.tryParseObjectId(libraryId);
    if (!objectId) {
      return null;
    }

    const libraryRepository = this.getLibraryRepository();
    const existingLibrary = await libraryRepository.findOneById(objectId);
    if (!existingLibrary) {
      return null;
    }

    Object.assign(existingLibrary, input);
    existingLibrary.updatedAt = new Date();

    const savedLibrary = await libraryRepository.save(existingLibrary);
    return this.mapLibrary(savedLibrary);
  }

  public async softDeleteLibrary(libraryId: string): Promise<LibraryRecord | null> {
    const objectId = this.tryParseObjectId(libraryId);
    if (!objectId) {
      return null;
    }

    const libraryRepository = this.getLibraryRepository();
    const existingLibrary = await libraryRepository.findOneById(objectId);
    if (!existingLibrary || existingLibrary.deletedAt) {
      return null;
    }

    const now = new Date();
    existingLibrary.deletedAt = now;
    existingLibrary.isActive = false;
    existingLibrary.isMarketplaceVisible = false;
    existingLibrary.updatedAt = now;

    const savedLibrary = await libraryRepository.save(existingLibrary);
    return this.mapLibrary(savedLibrary);
  }

  public async getPaymentMethods(libraryId: string): Promise<any[]> {
    const objectId = this.tryParseObjectId(libraryId);
    if (!objectId) {
      return [];
    }

    const library = await this.getLibraryRepository().findOneById(objectId);
    if (!library) {
      return [];
    }

    return library.paymentMethods ?? [];
  }

  public async updateLibrarySlots(
    libraryId: string,
    slots: CreateLibrarySlotInput[],
  ): Promise<LibraryRecord | null> {
    const objectId = this.tryParseObjectId(libraryId);
    if (!objectId) {
      return null;
    }

    const repo = this.getLibraryRepository();
    const library = await repo.findOneById(objectId);
    if (!library) {
      return null;
    }

    library.slots = slots as any;
    library.updatedAt = new Date();
    const saved = await repo.save(library);
    return this.mapLibrary(saved);
  }

  public async updateLibraryGeofence(
  libraryId: string,
  geofence: LibraryGeofenceInput,
): Promise<LibraryRecord | null> {
  const objectId = this.tryParseObjectId(libraryId);
  if (!objectId) return null;

  const repo = this.getLibraryRepository();
  const library = await repo.findOneById(objectId);
  if (!library) return null;

  library.geofence = geofence;
  library.updatedAt = new Date();

  const saved = await repo.save(library);
  return this.mapLibrary(saved);
}

  public async findManyByIds(ids: string[]): Promise<LibraryRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const objectIds = ids
      .map(id => this.tryParseObjectId(id))
      .filter((oid): oid is ObjectId => oid !== null);

    if (objectIds.length === 0) {
      return [];
    }

    const libraries = await this.getLibraryRepository().find({
      where: { _id: { $in: objectIds } } as any,
    });

    return libraries.map(library => this.mapLibrary(library));
  }

  public async updateLibraryStats(
    libraryId: string,
    stats: { rating: number; reviewCount: number },
  ): Promise<void> {
    const objectId = this.tryParseObjectId(libraryId);
    if (!objectId) {
      return;
    }

    const repo = this.getLibraryRepository();
    const library = await repo.findOneById(objectId);
    if (!library) {
      return;
    }

    library.stats = {
      ...library.stats,
      rating: stats.rating,
      reviewCount: stats.reviewCount,
    };
    library.updatedAt = new Date();
    await repo.save(library);
  }

  private async ensureIndexes(): Promise<void> {
    if (this.indexesEnsured) {
      return;
    }

    const libraryRepository = this.getLibraryRepository();
    await Promise.all([
      libraryRepository.createCollectionIndex(
        { location: '2dsphere' },
        { name: 'idx_libraries_location_2dsphere' },
      ),
      libraryRepository.createCollectionIndex(
        { isActive: 1, isMarketplaceVisible: 1, deletedAt: 1 },
        { name: 'idx_libraries_visibility' },
      ),
      libraryRepository.createCollectionIndex(
        { city: 1, isActive: 1 },
        { name: 'idx_libraries_city_active' },
      ),
      libraryRepository.createCollectionIndex(
        { name: 'text' },
        { name: 'idx_libraries_name_text' },
      ),
    ]);

    this.indexesEnsured = true;
  }

  private mapLibrary(library: LibraryModel): LibraryRecord {
    return {
      id: this.toHexString(library),
      ownerId: library.ownerId,
      name: library.name,
      description: library.description,
      contactPhone: library.contactPhone,
      contactEmail: library.contactEmail,
      address: library.address,
      city: library.city,
      state: library.state,
      pincode: library.pincode,
      location: library.location,
      totalSeats: library.totalSeats,
      seating: library.seating,
      facilities: library.facilities,
      slots: library.slots,
      photos: library.photos,
      paymentMethods: library.paymentMethods ?? [],
      isActive: library.isActive,
      isMarketplaceVisible: library.isMarketplaceVisible,
      isOpen: library.isOpen,
      openingHours: library.openingHours,
      stats: library.stats,
      geofence: library.geofence,
      deletedAt: library.deletedAt,
      createdAt: library.createdAt,
      updatedAt: library.updatedAt,
    };
  }

  private toHexString(value: WithObjectId): string {
    return value.id.toHexString();
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) {
      return null;
    }

    return new ObjectId(value);
  }

  private getLibraryRepository(): MongoRepository<LibraryModel> {
    return getDataSource().getMongoRepository(LibraryModel);
  }
}