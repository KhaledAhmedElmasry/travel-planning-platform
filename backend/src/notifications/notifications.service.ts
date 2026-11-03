import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

// Area: Community & Cross-cutting
// Business logic and database access for: GEN-01
@Injectable()
export class NotificationsService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async notify(
    userId: string | Types.ObjectId,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      await this.connection.db?.collection('notifications').insertOne({
        userId: new Types.ObjectId(userId),
        title,
        message,
        read: false,
        createdAt: new Date(),
      });
    } catch {
      // Notification failures should not block the primary action.
    }
  }
}
