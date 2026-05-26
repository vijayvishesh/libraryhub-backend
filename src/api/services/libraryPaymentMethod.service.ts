import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { LibraryRepository } from '../repositories/library.repository';
import { LibraryPaymentMethodRepository } from '../repositories/libraryPaymentMethod.repository';
import { UpdatePaymentMethodInput } from '../repositories/types/libraryPaymentMethod.repository.types';
import {
  LibraryPaymentMethodResult,
  UpdatePaymentMethodsPayload,
} from './types/libraryPaymentMethod.service.types';

@Service()
export class LibraryPaymentMethodService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly libraryPaymentMethodRepository: LibraryPaymentMethodRepository,
  ) {}

  // ── Owner: get all methods (enabled + disabled) ───────────────────────────

  public async getOwnerPaymentMethods(
    ownerId: string,
  ): Promise<LibraryPaymentMethodResult> {
    try {
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
      if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

      const record = await this.libraryPaymentMethodRepository.findByLibraryIdOrCreate(
        library.id,
        ownerId,
      );

      return { id: record.id, libraryId: record.libraryId, methods: record.methods };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_PAYMENT_METHODS_FAILED');
    }
  }

  // ── Owner: toggle methods on/off ──────────────────────────────────────────

  public async updateOwnerPaymentMethods(
    ownerId: string,
    payload: UpdatePaymentMethodsPayload,
  ): Promise<LibraryPaymentMethodResult> {
    try {
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
      if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

      const updates: UpdatePaymentMethodInput[] = payload.map(p => ({
        type: p.type,
        enabled: p.enabled,
        label: p.label,
      }));

      const record = await this.libraryPaymentMethodRepository.updateMethods(
        library.id,
        ownerId,
        updates,
      );

      return { id: record.id, libraryId: record.libraryId, methods: record.methods };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPDATE_PAYMENT_METHODS_FAILED');
    }
  }

  // ── Student: get only enabled methods ─────────────────────────────────────

  public async getStudentPaymentMethods(
    libraryId: string,
  ): Promise<LibraryPaymentMethodResult> {
    try {
      const library = await this.libraryRepository.findLibraryById(libraryId);
      if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

      const record = await this.libraryPaymentMethodRepository.findByLibraryId(libraryId);

      // If no record yet, return empty enabled methods
      const methods = (record?.methods ?? []).filter(m => m.enabled);

      return {
        id: record?.id ?? '',
        libraryId,
        methods,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_PAYMENT_METHODS_FAILED');
    }
  }

  // ── Save QR code URL (called from upload controller) ──────────────────────

  public async saveQrCodeUrl(
    ownerId: string,
    qrCodeUrl: string,
  ): Promise<void> {
    try {
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
      if (!library) return;

      await this.libraryPaymentMethodRepository.updateQrCodeUrl(
        library.id,
        ownerId,
        { type: 'qr_code', qrCodeUrl },
      );
    } catch {
      // non-critical — upload succeeded, just log failure
      console.warn('[LibraryPaymentMethodService] Failed to save QR code URL');
    }
  }
}