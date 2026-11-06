import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Put,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { HotelPoliciesDto } from './dto/hotel-policies.dto';
import { RoomAvailabilityDto } from './dto/room-availability.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import {
  deleteHotelPhotos,
  type HotelPhotoFile,
  storeHotelPhotos,
} from './hotel-photos';
import { HotelsService, MAX_HOTEL_PHOTOS } from './hotels.service';

// Area: Hotels & Rooms
// Requirements: HTL-01..HTL-06, HTL-08..HTL-12, HTL-15, HTL-22
// Endpoints to implement (PDF section 8):
//   POST   /api/hotels                                  HTL-01
//   GET    /api/hotels/search                           HTL-11, HTL-12
//   GET    /api/hotels/:id                              HTL-02
//   PATCH  /api/hotels/:id                              HTL-01
//   POST   /api/hotels/:id/rooms                        HTL-03
//   PATCH  /api/hotels/:id/rooms/:roomId                HTL-05
//   DELETE /api/hotels/:id/rooms/:roomId                HTL-06
//   GET    /api/hotels/:id/rooms/available              HTL-15
//   POST   /api/hotels/:id/rooms/:roomId/availability   HTL-04
//   PATCH  /api/hotels/:id/rooms/:roomId/availability   HTL-05, HTL-06
//   GET    /api/hotels/:id/availability                 HTL-08
//   PUT    /api/hotels/:id/policies                     HTL-08, HTL-10
//   GET    /api/hotels/:id/reservations                 HTL-22
// Notes:
//   The policies endpoint (PUT /api/hotels/:id/policies) also sets check-in / check-out times (HTL-09).
//   Photos are sent as multipart/form-data on POST /api/hotels and PATCH /api/hotels/:id; PATCH takes
//   removePhotoIds (HTL-01, GEN-08: up to 5 per hotel). There is no separate upload endpoint.
//   A room is deactivated through PATCH /api/hotels/:id/rooms/:roomId with active: false (HTL-06).
//   Admins create hotels; only the moderator assigned to THIS hotel may edit it (ACC-11, ACC-13).
//   Deactivated hotels (ACC-15) and deactivated rooms (HTL-06) are excluded from search.
//   Hotel search must be reusable from itineraries (ITN-25): keep it in the exported service.
//   Declare /hotels/search before /hotels/:id so "search" is not matched as an id.

// Multer keeps the files in memory by default. One more file than the limit is accepted on
// purpose, so the service answers with a clear "at most 5 photos" message instead of multer's
// generic "Unexpected field".
const photoUpload = FilesInterceptor('photos', MAX_HOTEL_PHOTOS + 1, {
  limits: { fileSize: 20 * 1024 * 1024 }, // hard cap; the 5 MB rule is checked in storeHotelPhotos
});

@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  // HTL-01: an admin creates a hotel (multipart).
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @UseInterceptors(photoUpload)
  async create(
    @Body() dto: CreateHotelDto,
    @UploadedFiles() files: HotelPhotoFile[],
  ) {
    const photos = await storeHotelPhotos(files ?? []);
    try {
      return await this.hotelsService.createHotel(dto, photos);
    } catch (error) {
      await deleteHotelPhotos(photos);
      throw error;
    }
  }

  // HTL-01: the moderator assigned to this hotel edits it (multipart).
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HotelModerator)
  @UseInterceptors(photoUpload)
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateHotelDto,
    @UploadedFiles() files: HotelPhotoFile[],
  ) {
    const photos = await storeHotelPhotos(files ?? []);
    try {
      return await this.hotelsService.updateHotel(id, user, dto, photos);
    } catch (error) {
      await deleteHotelPhotos(photos);
      throw error;
    }
  }

  // HTL-03: the moderator of this hotel adds a room.
  @Post(':id/rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HotelModerator)
  createRoom(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRoomDto,
  ) {
    return this.hotelsService.createRoom(id, user, dto);
  }

  // HTL-04: the moderator of this hotel adds a bookable date range to one of its rooms.
  @Post(':id/rooms/:roomId/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HotelModerator)
  addAvailability(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('roomId', ParseObjectIdPipe) roomId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RoomAvailabilityDto,
  ) {
    return this.hotelsService.addAvailableRange(id, roomId, user, dto);
  }

  // HTL-09, HTL-10: the moderator of this hotel sets check-in/out times and cancellation tiers.
  @Put(':id/policies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HotelModerator)
  updatePolicies(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: HotelPoliciesDto,
  ) {
    return this.hotelsService.updatePolicies(id, user, dto);
  }
}
