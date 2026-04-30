import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import {
  LibraryListQueryRequest,
  LibrarySetupRequest,
  UpdateLibraryRequest,
} from '../controllers/requests/library.request';
import {
  LibraryLocationData,
  LibraryPaymentMethodData,
  LibraryPhotoData,
  LibrarySeatingData,
  LibrarySeatingRangeData,
  LibrarySeatingSectionData,
  LibrarySetupData,
  LibrarySlotData,
  LibraryStatsData,
} from '../controllers/responses/library.response';
import { AuthRepository } from '../repositories/auth.repositories';
import { LibraryRepository } from '../repositories/library.repository';
import { AuthOwnerRecord, AuthTenantRecord } from '../repositories/types/auth.repository.types';
import {
  CreateLibraryInput,
  LibraryRecord,
  UpdateLibraryInput,
} from '../repositories/types/library.repository.types';
import { LibrarySeatService } from './librarySeat.service';
import { ListedLibrariesResult } from './types/library.service.types';

export type { ListedLibrariesResult };

@Service()
export class LibraryService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly librarySeatService: LibrarySeatService,
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

      try {
        await this.librarySeatService.syncLibrarySeatsFromLibrary(library);
      } catch {
        // Seat inventory sync should not block library create/update.
      }

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

  public async getLibraryById(libraryId: string): Promise<LibrarySetupData> {
    try {
      const library = await this.libraryRepository.findLibraryById(libraryId.trim());
      if (!library || library.deletedAt) {
        throw new NotFoundError('LIBRARY_NOT_FOUND');
      }

      if (!library.isActive || !library.isMarketplaceVisible) {
        throw new NotFoundError('LIBRARY_NOT_FOUND');
      }

      return this.mapLibrarySetupData(library);
    } catch (error) {
      this.rethrowLibraryError(error, 'GET_LIBRARY_BY_ID_FAILED');
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

  public async updateLibrary(
    ownerId: string,
    payload: UpdateLibraryRequest,
  ): Promise<LibrarySetupData> {
    try {
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
      if (!library || library.deletedAt) {
        throw new NotFoundError('LIBRARY_NOT_FOUND');
      }

      const updateInput = this.buildUpdateLibraryInput(payload);
      const updated = await this.libraryRepository.partialUpdateLibrary(library.id, updateInput);
      if (!updated) {
        throw new InternalServerError('LIBRARY_UPDATE_FAILED');
      }

      if (payload.totalSeats !== undefined || payload.seating !== undefined) {
        try {
          await this.librarySeatService.syncLibrarySeatsFromLibrary(updated);
        } catch {
          // Seat inventory sync should not block library update.
        }
      }

      return this.mapLibrarySetupData(updated);
    } catch (error) {
      this.rethrowLibraryError(error, 'LIBRARY_UPDATE_FAILED');
    }
  }

  public async deleteLibrary(ownerId: string): Promise<void> {
    try {
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
      if (!library || library.deletedAt) {
        throw new NotFoundError('LIBRARY_NOT_FOUND');
      }

      const deleted = await this.libraryRepository.softDeleteLibrary(library.id);
      if (!deleted) {
        throw new InternalServerError('LIBRARY_DELETE_FAILED');
      }
    } catch (error) {
      this.rethrowLibraryError(error, 'LIBRARY_DELETE_FAILED');
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
      contactPhone:
        payload.contactPhone?.trim() ??
        payload.ownerPhone?.trim() ??
        base?.contactPhone ??
        owner.phone,
      contactEmail:
        payload.contactEmail?.trim() ?? payload.ownerEmail?.trim() ?? base?.contactEmail ?? null,
      address: payload.address?.trim() ?? base?.address ?? '',
      city: payload.city?.trim() ?? base?.city ?? tenant.city,
      state: payload.state?.trim() ?? base?.state ?? '',
      pincode: payload.pincode?.trim() ?? base?.pincode ?? '',
      location: payload.location
        ? {
            type: payload.location.type,
            coordinates: [payload.location.coordinates[0], payload.location.coordinates[1]] as [
              number,
              number,
            ],
          }
        : payload.coordinates
          ? {
              type: 'Point',
              coordinates: [payload.coordinates.lng, payload.coordinates.lat] as [number, number],
            }
          : {
              type: base?.location.type ?? 'Point',
              coordinates: base?.location.coordinates ?? [0, 0],
            },
      totalSeats: payload.totalSeats ?? payload.seating?.total ?? base?.totalSeats ?? 1,
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
      seating: payload.seating ?? base?.seating,
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
      paymentMethods:
        payload.paymentMethods?.map(method => ({
          type: method.type,
          enabled: method.enabled ?? true,
          label: method.label?.trim() || this.getPaymentMethodDefaultLabel(method.type),
        })) ??
        base?.paymentMethods ??
        this.getDefaultPaymentMethods(),
      deletedAt: base?.deletedAt ?? null,
    };
  }

  private buildUpdateLibraryInput(payload: UpdateLibraryRequest): UpdateLibraryInput {
    const input: UpdateLibraryInput = {};

    if (payload.name !== undefined) {
      input.name = payload.name.trim();
    }
    if (payload.description !== undefined) {
      input.description = payload.description.trim();
    }
    if (payload.contactPhone !== undefined) {
      input.contactPhone = payload.contactPhone.trim();
    }
    if (payload.contactEmail !== undefined) {
      input.contactEmail = payload.contactEmail.trim();
    }
    if (payload.address !== undefined) {
      input.address = payload.address.trim();
    }
    if (payload.city !== undefined) {
      input.city = payload.city.trim();
    }
    if (payload.state !== undefined) {
      input.state = payload.state.trim();
    }
    if (payload.pincode !== undefined) {
      input.pincode = payload.pincode.trim();
    }
    if (payload.totalSeats !== undefined) {
      input.totalSeats = payload.totalSeats;
    }
    if (payload.facilities !== undefined) {
      input.facilities = payload.facilities;
    }
    if (payload.isActive !== undefined) {
      input.isActive = payload.isActive;
    }
    if (payload.isMarketplaceVisible !== undefined) {
      input.isMarketplaceVisible = payload.isMarketplaceVisible;
    }
    if (payload.isOpen !== undefined) {
      input.isOpen = payload.isOpen;
    }
    if (payload.openingHours !== undefined) {
      input.openingHours = payload.openingHours.trim();
    }
    if (payload.seating !== undefined) {
      input.seating = payload.seating;
    }

    if (payload.location) {
      input.location = {
        type: payload.location.type,
        coordinates: [payload.location.coordinates[0], payload.location.coordinates[1]],
      };
    } else if (payload.coordinates) {
      input.location = {
        type: 'Point',
        coordinates: [payload.coordinates.lng, payload.coordinates.lat],
      };
    }

    if (payload.slots) {
      input.slots = payload.slots.map(slot => ({
        slotType: slot.slotType,
        name: slot.name.trim(),
        startTime: slot.startTime,
        endTime: slot.endTime,
        pricePerMonth: slot.pricePerMonth,
        isActive: slot.isActive ?? true,
      }));
    }

    if (payload.photos) {
      input.photos = payload.photos.map((photo, index) => ({
        url: photo.url.trim(),
        publicId: photo.publicId?.trim() ?? null,
        order: photo.order ?? index,
        uploadedAt: new Date(),
      }));
    }

    if (payload.paymentMethods) {
      input.paymentMethods = payload.paymentMethods.map(method => ({
        type: method.type,
        enabled: method.enabled ?? true,
        label: method.label?.trim() || this.getPaymentMethodDefaultLabel(method.type),
      }));
    }

    return input;
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
      seating: library.seating
        ? new LibrarySeatingData({
            mode: library.seating.mode,
            total: library.seating.total,
            filled: library.seating.filled,
            available: library.seating.available,
            arrangement: library.seating.arrangement,
            boys: library.seating.boys,
            girls: library.seating.girls,
            open: library.seating.open,
            ranges: library.seating.ranges?.map(
              range => new LibrarySeatingRangeData(range.from, range.to, range.gender),
            ),
            genderMode: library.seating.genderMode,
            sections: library.seating.sections?.map(
              section =>
                new LibrarySeatingSectionData(
                  section.id,
                  section.name,
                  section.capacity,
                  section.filled,
                  section.available,
                  section.gender,
                ),
            ),
          })
        : undefined,
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
      paymentMethods: library.paymentMethods.map(
        method => new LibraryPaymentMethodData(method.type, method.enabled, method.label),
      ),
      deletedAt: library.deletedAt,
      createdAt: library.createdAt,
      updatedAt: library.updatedAt,
    });
  }

  private getDefaultPaymentMethods(): LibraryRecord['paymentMethods'] {
    return [
      { type: 'upi', enabled: true, label: 'UPI' },
      { type: 'cash', enabled: true, label: 'Cash' },
      { type: 'card', enabled: false, label: 'Card' },
      { type: 'wallet', enabled: false, label: 'Wallet' },
      { type: 'online', enabled: false, label: 'Online' },
    ];
  }

  private getPaymentMethodDefaultLabel(type: string): string {
    if (type === 'upi') {
      return 'UPI';
    }

    if (type === 'cash') {
      return 'Cash';
    }

    if (type === 'card') {
      return 'Card';
    }

    if (type === 'wallet') {
      return 'Wallet';
    }

    return 'Online';
  }

  private rethrowLibraryError(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new InternalServerError(defaultMessage);
  }
}
