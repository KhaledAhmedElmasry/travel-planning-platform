import { Controller } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Area: Community & Cross-cutting
// Requirements: GEN-01
// Endpoints to implement (PDF section 8):
//   none listed.
// Extra endpoints may be needed (not in the PDF tables) for:
//   the notification list, unread count and mark as read (GEN-01, GEN-05)
// Notes:
//   Other modules call NotificationsService for: booking confirmed / cancelled / refunded,
//   flight schedule change, and account or provider suspension (GEN-01).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // TODO: add the endpoints listed above.
}
