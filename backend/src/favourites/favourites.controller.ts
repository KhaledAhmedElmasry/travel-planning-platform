import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { ListFavouritesQueryDto } from './dto/list-favourites-query.dto';
import { FavouritesService } from './favourites.service';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Hotels & Rooms (bonus)
// Requirements: BON-02
// Endpoints to implement:
//   add, remove and list the user's favourite hotels and public itineraries   BON-02
@Controller('favourites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.User)
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() dto: AddFavouriteDto) {
    return this.favouritesService.add(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListFavouritesQueryDto) {
    return this.favouritesService.list(user.id, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    return this.favouritesService.remove(user.id, id);
  }
}
