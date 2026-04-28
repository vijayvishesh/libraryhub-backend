
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberInviteLinkModel } from '../models/memberInviteLink.model';
import {
  CreateMemberInviteLinkInput,
  MemberInviteLinkRecord,
} from './types/memberInviteLink.repository.types';

@Service()
export class MemberInviteLinkRepository {
  public async createInviteLink(
    input: CreateMemberInviteLinkInput,
  ): Promise<MemberInviteLinkRecord> {
    const repository = this.getRepository();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const link = repository.create({
      ...input,
      isUsed: false,
      createdAt: now,
      expiresAt,
      updatedAt: now,
    });

    const savedLink = await repository.save(link);
    return this.mapLink(savedLink);
  }

  public async findValidLinkByToken(token: string): Promise<MemberInviteLinkRecord | null> {
    const repository = this.getRepository();
    const now = new Date();

    const link = await repository.findOneBy({ token });
    if (!link) {
      return null;
    }

    if (link.isUsed) {
      return null;
    }

    if (link.expiresAt < now) {
      return null;
    }

    return this.mapLink(link);
  }

  public async markLinkAsUsed(
    token: string,
    memberId: string,
  ): Promise<MemberInviteLinkRecord | null> {
    const repository = this.getRepository();
    const link = await repository.findOneBy({ token });

    if (!link) {
      return null;
    }

    link.isUsed = true;
    link.usedAt = new Date();
    link.usedByMemberId = memberId;
    link.updatedAt = new Date();

    const savedLink = await repository.save(link);
    return this.mapLink(savedLink);
  }

  private mapLink(link: MemberInviteLinkModel): MemberInviteLinkRecord {
    return {
      id: link.id.toHexString(),
      ownerId: link.ownerId,
      libraryId: link.libraryId,
      siteLibraryId: link.siteLibraryId,
      token: link.token,
      isUsed: link.isUsed,
      usedAt: link.usedAt,
      usedByMemberId: link.usedByMemberId,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      updatedAt: link.updatedAt,
    };
  }

  private getRepository(): MongoRepository<MemberInviteLinkModel> {
    return getDataSource().getMongoRepository(MemberInviteLinkModel);
  }
}
