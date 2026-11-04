import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { LOGO_UPLOAD_LIMITS } from './airline-logo';
import type { UploadedLogo } from './airline-logo';
import { AirlinesService } from './airlines.service';
import { BaggagePolicyDto } from './dto/baggage-policy.dto';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';

// Area: Airlines & Flight Inventory
// Requirements: FLT-01, FLT-04, FLT-08, FLT-09
// Endpoints to implement (PDF section 8):
//   POST  /api/airlines                           FLT-01   (done)
//   GET   /api/airlines/:id                       FLT-01   (done)
//   PATCH /api/airlines/:id                       FLT-01   (done)
//   PUT   /api/airlines/:id/baggage-policy        FLT-04, FLT-08   (done)
//   PUT   /api/airlines/:id/cancellation-policy   FLT-09
// Notes:
//   The logo is sent as multipart/form-data on POST /api/airlines and PATCH /api/airlines/:id
//   (FLT-01, GEN-08: 1 logo per airline), as in openapi.yaml; there is no separate upload endpoint.
//   Admins create airlines; only the moderator assigned to THIS airline may edit it (ACC-11, ACC-13).
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  // FLT-01: an admin creates an airline (name, code, optional logo file in the "logo" field).
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @UseInterceptors(FileInterceptor('logo', { limits: LOGO_UPLOAD_LIMITS }))
  create(@Body() dto: CreateAirlineDto, @UploadedFile() logo?: UploadedLogo) {
    return this.airlinesService.create(dto, logo);
  }

  // FLT-01: the public airline profile (guests too). Deactivated airlines are 404 (ACC-15).
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.airlinesService.findPublic(id);
  }

  // FLT-01: the airline's own moderator edits name, code and logo. The ownership check
  // (403 "Not the moderator of this airline.") is in the service, for every role.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo', { limits: LOGO_UPLOAD_LIMITS }))
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateAirlineDto,
    @UploadedFile() logo?: UploadedLogo,
  ) {
    return this.airlinesService.update(user, id, dto, logo);
  }

  // FLT-08: the airline's own moderator sets the extra-baggage policy. The ownership check
  // (403 "Not the moderator of this airline.") is in the service.
  @Put(':id/baggage-policy')
  @UseGuards(JwtAuthGuard)
  setBaggagePolicy(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: BaggagePolicyDto,
  ) {
    return this.airlinesService.setBaggagePolicy(user, id, dto);
  }
}
