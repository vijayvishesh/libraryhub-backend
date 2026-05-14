import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('library_ratings')
@Index('idx_ratings_library_id', ['libraryId'])
@Index('idx_ratings_student_library', ['studentId', 'libraryId'])
export class LibraryRatingModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  libraryId!: string;

  @Column()
  studentId!: string;

  @Column()
  rating!: number; // 1-5

  @Column()
  review!: string | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
