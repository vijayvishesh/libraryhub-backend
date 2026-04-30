import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberBulkUploadModel } from '../models/memberBulkUpload.model';
import {
  CreateMemberBulkUploadInput,
  ListMemberBulkUploadsQuery,
  ListMemberBulkUploadsResult,
  MemberBulkUploadRecord,
} from './types/memberBulkUpload.repository.types';

@Service()
export class MemberBulkUploadRepository {
  public async createUpload(input: CreateMemberBulkUploadInput): Promise<MemberBulkUploadRecord> {
    const repository = this.getRepository();
    const now = new Date();
    const upload = repository.create({
      ...input,
      createdAt: now,
      updatedAt: now,
    });

    const savedUpload = await repository.save(upload);
    return this.mapUpload(savedUpload);
  }

  public async listUploadsByLibrary(
    query: ListMemberBulkUploadsQuery,
  ): Promise<ListMemberBulkUploadsResult> {
    const repository = this.getRepository();
    const filter: Record<string, unknown> = {
      libraryId: query.libraryId,
    };

    if (query.status) {
      filter.status = query.status;
    }

    const [uploads, total] = await Promise.all([
      repository.find({
        where: filter,
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      repository.count({ where: filter }),
    ]);

    return {
      uploads: uploads.map(upload => this.mapUpload(upload)),
      total,
    };
  }

  public async findUploadByIdAndLibrary(
    uploadId: string,
    libraryId: string,
  ): Promise<MemberBulkUploadRecord | null> {
    const objectId = this.tryParseObjectId(uploadId);
    if (!objectId) {
      return null;
    }

    const upload = await this.getRepository().findOneById(objectId);
    if (!upload || upload.libraryId !== libraryId) {
      return null;
    }

    return this.mapUpload(upload);
  }

  private mapUpload(upload: MemberBulkUploadModel): MemberBulkUploadRecord {
    return {
      id: upload.id.toHexString(),
      ownerId: upload.ownerId,
      libraryId: upload.libraryId,
      fileName: upload.fileName,
      status: upload.status,
      totalRows: upload.totalRows,
      successCount: upload.successCount,
      failedCount: upload.failedCount,
      rows: upload.rows,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
    };
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) {
      return null;
    }

    return new ObjectId(value);
  }

  private getRepository(): MongoRepository<MemberBulkUploadModel> {
    return getDataSource().getMongoRepository(MemberBulkUploadModel);
  }
}
