import { randomUUID } from 'crypto';
import { Service } from 'typedi';
import { CreateDemoRequest, UpdateDemoRequest } from '../controllers/requests/demo.request';
import { DemoResponse } from '../controllers/responses/demo.response';

@Service()
export class DemoRepository {
  private readonly items = new Map<string, DemoResponse>();

  public list(): DemoResponse[] {
    return Array.from(this.items.values()).sort(
      (left, right) => (right.updatedAt?.getTime() || 0) - (left.updatedAt?.getTime() || 0),
    );
  }

  public getById(id: string): DemoResponse | null {
    return this.items.get(id) || null;
  }

  public create(payload: CreateDemoRequest): DemoResponse {
    const now = new Date();
    const item: DemoResponse = {
      id: randomUUID(),
      name: payload.name,
      description: payload.description,
      createdAt: now,
      updatedAt: now,
    };

    this.items.set(item.id, item);
    return item;
  }

  public update(id: string, payload: UpdateDemoRequest): DemoResponse | null {
    const current = this.items.get(id);
    if (!current) {
      return null;
    }

    const updated: DemoResponse = {
      ...current,
      name: payload.name ?? current.name,
      description: payload.description ?? current.description,
      updatedAt: new Date(),
    };

    this.items.set(id, updated);
    return updated;
  }

  public delete(id: string): boolean {
    return this.items.delete(id);
  }
}
