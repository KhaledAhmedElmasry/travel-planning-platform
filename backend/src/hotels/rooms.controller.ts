import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { UpdateRoomAvailabilityDto } from './dto/update-room-availability.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

// Area: Hotels & Rooms
// Room management by the moderator of the hotel, under /api/hotels/:id/rooms/:roomId:
//   PATCH  /api/hotels/:id/rooms/:roomId                HTL-05, HTL-06 (active: false deactivates)
//   DELETE /api/hotels/:id/rooms/:roomId                HTL-06
//   PATCH  /api/hotels/:id/rooms/:roomId/availability   HTL-05 (remove), HTL-06 (block, unblock)
// Kept apart from hotels.controller.ts so room management and the hotel profile can change in
// separate pull requests.
@Controller('hotels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.HotelModerator)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // HTL-05: edit beds, maximum occupancy and price per night. HTL-06: active false / true.
  @Patch(':id/rooms/:roomId')
  updateRoom(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('roomId', ParseObjectIdPipe) roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.updateRoom(id, roomId, user, dto);
  }

  // HTL-06: delete a room that has never been reserved (the frontend confirms first, GEN-03).
  @Delete(':id/rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoom(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('roomId', ParseObjectIdPipe) roomId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.roomsService.deleteRoom(id, roomId, user);
  }

  // HTL-05: remove bookable nights. HTL-06: block and unblock nights.
  @Patch(':id/rooms/:roomId/availability')
  updateAvailability(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('roomId', ParseObjectIdPipe) roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRoomAvailabilityDto,
  ) {
    return this.roomsService.updateAvailability(id, roomId, user, dto);
  }
}
