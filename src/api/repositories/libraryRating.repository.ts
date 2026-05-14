import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { LibraryRatingModel } from '../models/libraryRating.model';
import {
  CreateLibraryRatingInput,
  LibraryRatingRecord,
} from './types/libraryRating.repository.types';

@Service()
export class LibraryRatingRepository {
  private getRepo(): MongoRepository<LibraryRatingModel> {
    return getDataSource().getMongoRepository(LibraryRatingModel);
  }

  private toRecord(model: LibraryRatingModel): LibraryRatingRecord {
    return {
      id: model.id.toHexString(),
      libraryId: model.libraryId,
      studentId: model.studentId,
      rating: model.rating,
      review: model.review,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async findByStudentAndLibrary(
    studentId: string,
    libraryId: string,
  ): Promise<LibraryRatingRecord | null> {
    const model = await this.getRepo().findOne({
      where: { studentId, libraryId } as any,
    });
    return model ? this.toRecord(model) : null;
  }

  public async findByLibrary(libraryId: string): Promise<LibraryRatingRecord[]> {
    const models = await this.getRepo().find({
      where: { libraryId } as any,
      order: { createdAt: 'DESC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async create(input: CreateLibraryRatingInput): Promise<LibraryRatingRecord> {
    const now = new Date();
    const repo = this.getRepo();
    const model = repo.create({ ...input, createdAt: now, updatedAt: now });
    const saved = await repo.save(model);
    return this.toRecord(saved);
  }

  public async update(
    id: string,
    rating: number,
    review: string | null,
  ): Promise<LibraryRatingRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing) {
      return null;
    }
    existing.rating = rating;
    existing.review = review;
    existing.updatedAt = new Date();
    const saved = await repo.save(existing);
    return this.toRecord(saved);
  }

  public async getAverageRating(libraryId: string): Promise<{ average: number; count: number }> {
    const ratings = await this.getRepo().find({
      where: { libraryId } as any,
    });
    if (ratings.length === 0) {
      return { average: 0, count: 0 };
    }
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const average = Math.round((sum / ratings.length) * 10) / 10;
    return { average, count: ratings.length };
  }
}
