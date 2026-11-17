import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import type { AuthUser } from '../common/interfaces';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

// Area: Community & Cross-cutting
// Requirements: GEN-01
// Endpoints implemented:
//   GET   /api/notifications               GEN-01, GEN-05 (user notification list)
//   GET   /api/notifications/unread-count  GEN-01 (badge unread count)
//   PATCH /api/notifications/read-all      GEN-01 (mark all notifications read)
//   PATCH /api/notifications/:id/read      GEN-01 (mark single notification read)
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // GEN-01: List logged-in user's notifications
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return await this.notificationsService.list(user, query);
  }

  // GEN-01: Unread notifications count
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    return await this.notificationsService.getUnreadCount(user);
  }

  // GEN-01: Mark all notifications as read
  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: AuthUser) {
    return await this.notificationsService.markAllAsRead(user);
  }

  // GEN-01: Mark a single notification as read
  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ) {
    return await this.notificationsService.markAsRead(user, id.toString());
  }
}
