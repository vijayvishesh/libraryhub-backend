import { Service } from 'typedi';
import { CreateDemoRequest, UpdateDemoRequest } from '../controllers/requests/demo.request';
import { DemoListResponse, DemoResponse } from '../controllers/responses/demo.response';
import { NotFoundError } from '../errors/notFound.error';
import { DemoRepository } from '../repositories/demo.repository';

@Service()
export class DemoService {
  constructor(private readonly demoRepository: DemoRepository) {}

  public getSummary() {
    return {
      service: 'demo',
      mongoConnection: false,
      message: 'Demo service is running without MongoDB',
    };
  }

  public list(): DemoListResponse {
    return {
      items: this.demoRepository.list(),
    };
  }

  public getById(id: string): DemoResponse {
    const item = this.demoRepository.getById(id);
    if (!item) {
      throw new NotFoundError();
    }

    return item;
  }

  public create(payload: CreateDemoRequest): DemoResponse {
    return this.demoRepository.create(payload);
  }

  public update(id: string, payload: UpdateDemoRequest): DemoResponse {
    const item = this.demoRepository.update(id, payload);
    if (!item) {
      throw new NotFoundError();
    }

    return item;
  }

  public delete(id: string): { deleted: boolean; id: string } {
    const deleted = this.demoRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError();
    }

    return { deleted: true, id };
  }
}
