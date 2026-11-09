import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';

// BONUS (optional): implement only after all mandatory requirements are done (PDF section 12).
// Area: Community & Cross-cutting (bonus)
// Requirements: GEN-01-B (also used by ACC-02 and ACC-07)
// No endpoints: other modules inject MailService.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
