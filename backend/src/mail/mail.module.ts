import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// No endpoints: other modules inject MailService.
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
