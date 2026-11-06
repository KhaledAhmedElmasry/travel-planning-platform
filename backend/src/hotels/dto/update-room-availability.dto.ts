import { IsEnum, Matches } from 'class-validator';

// PATCH /api/hotels/:id/rooms/:roomId/availability (HTL-05, HTL-06)
// from is the first night and to is the last night, both included.

export enum RoomAvailabilityAction {
  Remove = 'remove', // HTL-05: remove bookable nights
  Block = 'block', // HTL-06: block nights so they cannot be booked
  Unblock = 'unblock', // HTL-06: remove a block again
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateRoomAvailabilityDto {
  @IsEnum(RoomAvailabilityAction, {
    message: `action must be one of: ${Object.values(RoomAvailabilityAction).join(', ')}`,
  })
  action: RoomAvailabilityAction;

  @Matches(DATE_PATTERN, {
    message: 'from must be a date in the format YYYY-MM-DD, e.g. 2027-03-24',
  })
  from: string;

  @Matches(DATE_PATTERN, {
    message: 'to must be a date in the format YYYY-MM-DD, e.g. 2027-03-26',
  })
  to: string;
}
