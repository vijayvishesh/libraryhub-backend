import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import {
  LibraryPaymentMethodModel,
  PaymentMethodConfig,
} from '../models/libraryPaymentMethod.model';
import {
  LibraryPaymentMethodRecord,
  UpdatePaymentMethodInput,
  UpdateQrCodeInput,
} from './types/libraryPaymentMethod.repository.types';

const DEFAULT_METHODS: PaymentMethodConfig[] = [
  { type: 'cash', enabled: false, label: 'Cash', qrCodeUrl: null },
  { type: 'qr_code', enabled: false, label: 'QR Code', qrCodeUrl: null },
];

type WithObjectId = { id: ObjectId };

@Service()
export class LibraryPaymentMethodRepository {
  // ── Find or create ────────────────────────────────────────────────────────

  public async findByLibraryId(
    libraryId: string,
  ): Promise<LibraryPaymentMethodRecord | null> {
    const doc = await this.getRepo().findOneBy({ libraryId });
    if (!doc) return null;
    return this.map(doc);
  }

  public async findByLibraryIdOrCreate(
    libraryId: string,
    ownerId: string,
  ): Promise<LibraryPaymentMethodRecord> {
    const existing = await this.findByLibraryId(libraryId);
    if (existing) return existing;
    return this.create(libraryId, ownerId);
  }

  public async create(
    libraryId: string,
    ownerId: string,
  ): Promise<LibraryPaymentMethodRecord> {
    const repo = this.getRepo();
    const now = new Date();
    const doc = repo.create({
      libraryId,
      ownerId,
      methods: DEFAULT_METHODS,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(doc);
    return this.map(saved);
  }

  // ── Toggle enabled/disabled ───────────────────────────────────────────────

  public async updateMethods(
    libraryId: string,
    ownerId: string,
    updates: UpdatePaymentMethodInput[],
  ): Promise<LibraryPaymentMethodRecord> {
    const record = await this.findByLibraryIdOrCreate(libraryId, ownerId);
    const repo = this.getRepo();
    const objectId = this.tryParseObjectId(record.id);
    if (!objectId) throw new Error('INVALID_ID');

    const doc = await repo.findOneById(objectId);
    if (!doc) throw new Error('NOT_FOUND');

    doc.methods = doc.methods.map(method => {
      const update = updates.find(u => u.type === method.type);
      if (!update) return method;
      return {
        ...method,
        enabled: update.enabled,
        label: update.label ?? method.label,
      };
    });

    doc.updatedAt = new Date();
    const saved = await repo.save(doc);
    return this.map(saved);
  }

  // ── Save QR code URL ──────────────────────────────────────────────────────

  public async updateQrCodeUrl(
    libraryId: string,
    ownerId: string,
    input: UpdateQrCodeInput,
  ): Promise<LibraryPaymentMethodRecord> {
    const record = await this.findByLibraryIdOrCreate(libraryId, ownerId);
    const repo = this.getRepo();
    const objectId = this.tryParseObjectId(record.id);
    if (!objectId) throw new Error('INVALID_ID');

    const doc = await repo.findOneById(objectId);
    if (!doc) throw new Error('NOT_FOUND');

    doc.methods = doc.methods.map(method => {
      if (method.type !== input.type) return method;
      return { ...method, qrCodeUrl: input.qrCodeUrl };
    });

    doc.updatedAt = new Date();
    const saved = await repo.save(doc);
    return this.map(saved);
  }

  // ── Mapper ────────────────────────────────────────────────────────────────

  private map(doc: LibraryPaymentMethodModel): LibraryPaymentMethodRecord {
    return {
      id: this.toHexString(doc),
      libraryId: doc.libraryId,
      ownerId: doc.ownerId,
      methods: doc.methods,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toHexString(value: WithObjectId): string {
    return value.id.toHexString();
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) return null;
    return new ObjectId(value);
  }

  private getRepo(): MongoRepository<LibraryPaymentMethodModel> {
    return getDataSource().getMongoRepository(LibraryPaymentMethodModel);
  }
}