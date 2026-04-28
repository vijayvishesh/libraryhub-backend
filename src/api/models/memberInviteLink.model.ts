import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('member_invite_links')
@Index('idx_member_invite_links_token_unique', ['token'], { unique: true })
@Index('idx_member_invite_links_library_site_library_id', ['libraryId', 'siteLibraryId'])
@Index('idx_member_invite_links_expires_at', ['expiresAt'])
export class MemberInviteLinkModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  ownerId!: string;

  @Column()
  libraryId!: string;

  @Column()
  siteLibraryId!: string;

  @Column()
  token!: string;

  @Column()
  isUsed!: boolean;

  @Column()
  usedAt?: Date;

  @Column()
  usedByMemberId?: string;

  @Column()
  createdAt!: Date;

  @Column()
  expiresAt!: Date;

  @Column()
  updatedAt!: Date;
}
