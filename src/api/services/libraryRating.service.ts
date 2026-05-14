import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { RateLibraryRequest } from '../controllers/requests/libraryRating.request';
import { LibraryRepository } from '../repositories/library.repository';
import { LibraryRatingRepository } from '../repositories/libraryRating.repository';
import { MemberRepository } from '../repositories/member.repository';
import { LibraryRatingRecord } from '../repositories/types/libraryRating.repository.types';

@Service()
export class LibraryRatingService {
  constructor(
    private readonly ratingRepository: LibraryRatingRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly memberRepository: MemberRepository,
  ) {}

  public async rateLibrary(
    studentId: string,
    libraryId: string,
    input: RateLibraryRequest,
  ): Promise<LibraryRatingRecord> {
    // Check library exists
    const library = await this.libraryRepository.findLibraryById(libraryId);
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    // Check student has active membership
    const member = await this.memberRepository.findMemberByStudentIdAndLibrary(
      studentId,
      libraryId,
    );
    if (!member || member.status !== 'active') {
      throw new BadRequestError('MUST_BE_ACTIVE_MEMBER_TO_RATE');
    }

    // Check if already rated — update if yes
    const existing = await this.ratingRepository.findByStudentAndLibrary(studentId, libraryId);
    let record: LibraryRatingRecord;

    if (existing) {
      const updated = await this.ratingRepository.update(
        existing.id,
        input.rating,
        input.review ?? null,
      );
      if (!updated) {
        throw new NotFoundError('RATING_NOT_FOUND');
      }
      record = updated;
    } else {
      record = await this.ratingRepository.create({
        libraryId,
        studentId,
        rating: input.rating,
        review: input.review ?? null,
      });
    }

    // Update library stats
    const { average, count } = await this.ratingRepository.getAverageRating(libraryId);
    await this.libraryRepository.updateLibraryStats(libraryId, {
      rating: average,
      reviewCount: count,
    });

    return record;
  }

  public async getLibraryRatingSummary(
    libraryId: string,
  ): Promise<{ average: number; count: number }> {
    return this.ratingRepository.getAverageRating(libraryId);
  }
}
