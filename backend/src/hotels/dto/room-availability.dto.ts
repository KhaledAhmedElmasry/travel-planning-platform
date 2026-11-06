import { Matches } from 'class-validator';

// POST /api/hotels/:id/rooms/:roomId/availability (HTL-04)
// A range of nights: from is the first night and to is the last night, both included.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class RoomAvailabilityDto {
  @Matches(DATE_PATTERN, {
    message: 'from must be a date in the format YYYY-MM-DD, e.g. 2027-03-01',
  })
  from: string;

  @Matches(DATE_PATTERN, {
    message: 'to must be a date in the format YYYY-MM-DD, e.g. 2027-03-31',
  })
  to: string;
}
