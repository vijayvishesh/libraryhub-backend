import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import {
  LibraryListQueryRequest,
  LibrarySetupRequest,
} from '../controllers/requests/library.request';
import {
  LibraryLocationData,
  LibraryPhotoData,
  LibrarySetupData,
  LibrarySlotData,
  LibraryStatsData,
} from '../controllers/responses/library.response';
import { AuthRepository } from '../repositories/auth.repositories';
import { LibraryRepository } from '../repositories/library.repository';
import { AuthOwnerRecord, AuthTenantRecord } from '../repositories/types/auth.repository.types';
import { CreateLibraryInput, LibraryRecord } from '../repositories/types/library.repository.types';

export type ListedLibrariesResult = {
  libraries: LibrarySetupData[];
  page: number;
  limit: number;
  total: number;
};

@Service()
export class LibraryService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  public async setupLibrary(
    ownerId: string,
    payload: LibrarySetupRequest,
  ): Promise<LibrarySetupData> {
    try {
      const owner = await this.authRepository.findOwnerById(ownerId.trim());

      if (!owner) {
        throw new NotFoundError('OWNER_NOT_FOUND');
      }

      const tenant = await this.authRepository.findTenantById(owner.tenantId);
      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND');
      }

      const existingLibrary = await this.libraryRepository.findLibraryByOwnerId(owner.id);
      const libraryInput = this.buildCreateLibraryInput(payload, owner, tenant, existingLibrary);
      const library = existingLibrary
        ? await this.libraryRepository.updateLibrary(existingLibrary.id, libraryInput)
        : await this.libraryRepository.createLibrary(libraryInput);

      if (!library) {
        throw new InternalServerError('LIBRARY_SETUP_FAILED');
      }

      await Promise.all([
        this.authRepository.updateTenantSetupCompleted(owner.tenantId, true),
        this.authRepository.updateOwnerHasCreatedLibrary(owner.id, true),
      ]);
      return this.mapLibrarySetupData(library);
    } catch (error) {
      this.rethrowLibraryError(error, 'LIBRARY_SETUP_FAILED');
    }
  }

  public async getLibraryByOwnerId(ownerId: string): Promise<LibrarySetupData> {
    try {
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
      if (!library) {
        throw new NotFoundError('LIBRARY_NOT_FOUND');
      }

      return this.mapLibrarySetupData(library);
    } catch (error) {
      this.rethrowLibraryError(error, 'GET_OWNER_LIBRARY_FAILED');
    }
  }

  public async getListedLibraries(query: LibraryListQueryRequest): Promise<ListedLibrariesResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const result = await this.libraryRepository.findListedLibraries({
        search: query.search?.trim() || undefined,
        city: query.city?.trim() || undefined,
        page,
        limit,
      });

      return {
        libraries: result.libraries.map(library => this.mapLibrarySetupData(library)),
        page,
        limit,
        total: result.total,
      };
    } catch (error) {
      this.rethrowLibraryError(error, 'GET_LISTED_LIBRARIES_FAILED');
    }
  }

  private buildCreateLibraryInput(
    payload: LibrarySetupRequest,
    owner: AuthOwnerRecord,
    tenant: AuthTenantRecord,
    existingLibrary: LibraryRecord | null,
  ): CreateLibraryInput {
    const base = existingLibrary;

    return {
      ownerId: owner.id,
      name: payload.name?.trim() ?? base?.name ?? tenant.name,
      description: payload.description?.trim() ?? base?.description ?? '',
      contactPhone: payload.contactPhone?.trim() ?? base?.contactPhone ?? owner.phone,
      contactEmail: payload.contactEmail?.trim() ?? base?.contactEmail ?? null,
      address: payload.address?.trim() ?? base?.address ?? '',
      city: payload.city?.trim() ?? base?.city ?? tenant.city,
      state: payload.state?.trim() ?? base?.state ?? '',
      pincode: payload.pincode?.trim() ?? base?.pincode ?? '',
      location: {
        type: payload.location?.type ?? base?.location.type ?? 'Point',
        coordinates: payload.location
          ? [payload.location.coordinates[0], payload.location.coordinates[1]]
          : (base?.location.coordinates ?? [0, 0]),
      },
      totalSeats: payload.totalSeats ?? base?.totalSeats ?? 1,
      facilities: payload.facilities ?? base?.facilities ?? [],
      slots:
        payload.slots?.map(slot => ({
          slotType: slot.slotType,
          name: slot.name.trim(),
          startTime: slot.startTime,
          endTime: slot.endTime,
          pricePerMonth: slot.pricePerMonth,
          isActive: slot.isActive ?? true,
        })) ??
        base?.slots ??
        [],
      photos:
        payload.photos?.map((photo, index) => ({
          url: photo.url.trim(),
          publicId: photo.publicId?.trim() ?? null,
          order: photo.order ?? index,
          uploadedAt: new Date(),
        })) ??
        base?.photos ??
        [],
      isActive: payload.isActive ?? base?.isActive ?? true,
      isMarketplaceVisible: payload.isMarketplaceVisible ?? base?.isMarketplaceVisible ?? true,
      isOpen: payload.isOpen ?? base?.isOpen ?? true,
      openingHours: payload.openingHours?.trim() ?? base?.openingHours ?? '24/7',
      stats: {
        totalMembers: payload.stats?.totalMembers ?? base?.stats.totalMembers ?? 0,
        activeMembers: payload.stats?.activeMembers ?? base?.stats.activeMembers ?? 0,
        rating: payload.stats?.rating ?? base?.stats.rating ?? 0,
        reviewCount: payload.stats?.reviewCount ?? base?.stats.reviewCount ?? 0,
      },
      deletedAt: base?.deletedAt ?? null,
    };
  }

  private mapLibrarySetupData(library: LibraryRecord): LibrarySetupData {
    return new LibrarySetupData({
      id: library.id,
      ownerId: library.ownerId,
      name: library.name,
      description: library.description,
      contactPhone: library.contactPhone,
      contactEmail: library.contactEmail,
      address: library.address,
      city: library.city,
      state: library.state,
      pincode: library.pincode,
      location: new LibraryLocationData(library.location.type, library.location.coordinates),
      totalSeats: library.totalSeats,
      facilities: library.facilities,
      slots: library.slots.map(
        slot =>
          new LibrarySlotData(
            slot.slotType,
            slot.name,
            slot.startTime,
            slot.endTime,
            slot.pricePerMonth,
            slot.isActive,
          ),
      ),
      photos: library.photos.map(
        photo => new LibraryPhotoData(photo.url, photo.publicId, photo.order, photo.uploadedAt),
      ),
      isActive: library.isActive,
      isMarketplaceVisible: library.isMarketplaceVisible,
      isOpen: library.isOpen,
      openingHours: library.openingHours,
      stats: new LibraryStatsData(
        library.stats.totalMembers,
        library.stats.activeMembers,
        library.stats.rating,
        library.stats.reviewCount,
      ),
      deletedAt: library.deletedAt,
      createdAt: library.createdAt,
      updatedAt: library.updatedAt,
    });
  }

  private rethrowLibraryError(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new InternalServerError(defaultMessage);
  }
}
