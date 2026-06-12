import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('web_views')
@Index('idx_web_views_role', ['role'])
@Index('idx_web_views_scope', ['scope'])
@Index('idx_web_views_libraryId', ['libraryId'])
export class WebViewModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  title!: string;

  @Column()
  url!: string;

  @Column()
  icon!: string;

  @Column()
  isShow!: boolean;

  @Column()
  role!: 'student' | 'owner' | 'both';

  @Column()
  scope!: 'global' | 'library';

  @Column()
  libraryId!: string | null; // null = global

  @Column()
  order!: number;

  @Column()
isWebViewApiNeedToCall?: boolean;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}