import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { SuperAdminModel } from '../models/superAdmin.model';
import {
  CreateSuperAdminInput,
  SuperAdminRecord,
} from './types/superAdmin.repository.types';

@Service()
export class SuperAdminRepository {
  private getRepo(): MongoRepository<SuperAdminModel> {
    return getDataSource().getMongoRepository(SuperAdminModel);
  }

  private toRecord(model: SuperAdminModel): SuperAdminRecord {
    return {
      id: model.id.toHexString(),
      name: model.name,
      email: model.email,
      password: model.password,
      role: model.role,
      isActive: model.isActive,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async findByEmail(email: string): Promise<SuperAdminRecord | null> {
    const model = await this.getRepo().findOne({
      where: { email: email.toLowerCase() } as any,
    });
    return model ? this.toRecord(model) : null;
  }

  public async findById(id: string): Promise<SuperAdminRecord | null> {
    const models = await this.getRepo().find({
      where: {} as any,
    });
    const model = models.find(m => m.id.toHexString() === id);
    return model ? this.toRecord(model) : null;
  }

  public async create(input: CreateSuperAdminInput): Promise<SuperAdminRecord> {
    const now = new Date();
    const repo = this.getRepo();
    const model = repo.create({
      name: input.name,
      email: input.email.toLowerCase(),
      password: input.password,
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(model);
    return this.toRecord(saved);
  }
}