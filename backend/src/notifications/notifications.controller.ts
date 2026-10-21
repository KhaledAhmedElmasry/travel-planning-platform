import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

// Owner: Member 3 (Community & Cross-cutting)
// Requirements: GEN-01
// Endpoints to implement (PDF section 8):
//   (add endpoints as needed, PDF section 8.10). GEN-01 needs:
//   the user's notification list, the unread count, and marking notifications as read
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // TODO: add the endpoints listed above.
}
