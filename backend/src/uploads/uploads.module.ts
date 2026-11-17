import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';

// GEN-08: the shared image storage used by blog posts (BLG-10) and activities (ITN-12). The
// upload endpoints live in the modules that own the images.
@Module({
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
