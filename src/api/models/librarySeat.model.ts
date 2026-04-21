import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('library_seats')
@Index('idx_library_seats_library_seat_unique', ['libraryId', 'seatId'], { unique: true })
@Index('idx_library_seats_library_section_active', ['libraryId', 'sectionId', 'isActive'])
@Index('idx_library_seats_library_gender_active', ['libraryId', 'gender', 'isActive'])
export class LibrarySeatModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  libraryId!: string;

  @Column()
  seatId!: string;

  @Column()
  label!: string;

  @Column()
  sectionId!: string | null;

  @Column()
  sectionName!: string | null;

  @Column()
  gender!: 'any' | 'male' | 'female';

  @Column()
  sequence!: number;

  @Column()
  isActive!: boolean;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
