import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import type { AuthUser } from '../common/interfaces';
import { MailService } from '../mail/mail.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  readAt?: Date;
  link?: string;
  createdAt: Date;
}

export type LeanNotification = Notification & { _id: Types.ObjectId };

// Area: Community & Cross-cutting
// Business logic and database access for: GEN-01
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
  ) {}

  // GEN-01, GEN-01-B: Create an in-app notification and mirror it via email (called by other services)
  async notify(
    userId: string | Types.ObjectId,
    title: string,
    message: string,
    type = 'general',
    link?: string,
  ): Promise<void> {
    try {
      const userObjectId =
        typeof userId === 'string' && Types.ObjectId.isValid(userId)
          ? new Types.ObjectId(userId)
          : (userId as Types.ObjectId);

      const notification = new this.notificationModel({
        userId: userObjectId,
        title: title.trim(),
        message: message.trim(),
        type,
        read: false,
        link: link ?? null,
      });

      await notification.save();

      // GEN-01-B: Send the notification by email via SMTP
      try {
        const user = await this.userModel
          .findById(userObjectId)
          .select('email')
          .lean()
          .exec();

        if (user?.email) {
          await this.mailService.sendNotificationEmail(
            user.email,
            title.trim(),
            message.trim(),
            link ?? null,
          );
        }
      } catch (mailError) {
        this.logger.error(
          'Failed to send notification email (GEN-01-B)',
          mailError,
        );
      }
    } catch (error) {
      // Notification failures should never block the primary action.
      this.logger.error('Failed to create in-app notification', error);
    }
  }

  // GEN-01: List current user's notifications (newest first, paginated)
  async list(
    user: AuthUser,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedList<NotificationItem>> {
    const filter: FilterQuery<NotificationDocument> = {
      userId: new Types.ObjectId(user.id),
    };

    if (query.unreadOnly === true) {
      filter.read = false;
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<LeanNotification[]>()
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);

    const items = notifications.map((n) => this.mapNotification(n));
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  // GEN-01: Unread notification count for current user
  async getUnreadCount(
    user: AuthUser,
  ): Promise<{ count: number; unreadCount: number }> {
    const count = await this.notificationModel
      .countDocuments({
        userId: new Types.ObjectId(user.id),
        read: false,
      })
      .exec();

    return { count, unreadCount: count };
  }

  // GEN-01: Mark a single notification as read
  async markAsRead(user: AuthUser, id: string): Promise<NotificationItem> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid notification ID');
    }

    const notification = await this.notificationModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(user.id),
      })
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    return this.mapNotification(notification);
  }

  // GEN-01: Mark all notifications as read for current user
  async markAllAsRead(
    user: AuthUser,
  ): Promise<{ message: string; count: number }> {
    const result = await this.notificationModel
      .updateMany(
        {
          userId: new Types.ObjectId(user.id),
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        },
      )
      .exec();

    return {
      message: 'All notifications marked as read',
      count: result.modifiedCount,
    };
  }

  private mapNotification(
    n:
      | NotificationDocument
      | LeanNotification
      | (Notification & { _id: Types.ObjectId }),
  ): NotificationItem {
    const id = (n as { _id: Types.ObjectId })._id.toString();
    const createdAt = n.createdAt ?? new Date();

    return {
      id,
      userId: n.userId.toString(),
      title: n.title,
      message: n.message,
      type: n.type ?? 'general',
      read: n.read,
      readAt: n.readAt ?? undefined,
      link: n.link ?? undefined,
      createdAt,
    };
  }
}
