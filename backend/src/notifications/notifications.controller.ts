import { Controller } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Area: Community & Cross-cutting
// Requirements: GEN-01
// Endpoints to implement (PDF section 8):
//   (add endpoints as needed, PDF section 8.10). GEN-01 needs, for example:
//   GET   /api/notifications                GEN-01, GEN-05   (current user's list, paginated)
//   GET   /api/notifications/unread-count   GEN-01
//   PATCH /api/notifications/:id/read       GEN-01
//   PATCH /api/notifications/read-all       GEN-01
// Notes:
//   Other modules call NotificationsService for: booking confirmed / cancelled / refunded,
//   flight schedule change, and account or provider suspension (GEN-01).
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // TODO: add the endpoints listed above.
}
