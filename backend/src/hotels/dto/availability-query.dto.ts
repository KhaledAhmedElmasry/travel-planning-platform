import { Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto';

// Area: Hotels & Rooms
// Used by: GET /api/hotels/:id/availability (query)
// Requirements: HTL-08, GEN-05

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AvailabilityQueryDto extends PaginationQueryDto {
  @Matches(DATE_PATTERN, {
    message: 'from must be a date in the format YYYY-MM-DD, e.g. 2027-03-01',
  })
  from: string;

  @Matches(DATE_PATTERN, {
    message: 'to must be a date in the format YYYY-MM-DD, e.g. 2027-03-07',
  })
  to: string;
}
