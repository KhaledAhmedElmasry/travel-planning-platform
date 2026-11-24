import { Global, Module } from '@nestjs/common';
import { RevalidationService } from './revalidation.service';

// B5: global, so blog, itineraries, reports, users and admin can tell the frontend which cached
// pages to refresh without importing each other.
@Global()
@Module({
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
