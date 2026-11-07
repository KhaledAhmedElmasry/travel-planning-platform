import { Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto';

// Area: Hotels & Rooms
// Used by: GET /api/hotels/:id/rooms/available (query)
// Requirements: HTL-15, GEN-05
// checkIn is the arrival day and checkOut the departure day: the nights are checkIn up to the
// night before checkOut.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AvailableRoomsQueryDto extends PaginationQueryDto {
  @Matches(DATE_PATTERN, {
    message: 'checkIn must be a date in the format YYYY-MM-DD, e.g. 2027-03-01',
  })
  checkIn: string;

  @Matches(DATE_PATTERN, {
    message:
      'checkOut must be a date in the format YYYY-MM-DD, e.g. 2027-03-05',
  })
  checkOut: string;
}
