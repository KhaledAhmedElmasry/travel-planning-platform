import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { ContentType } from '../../common/enums';

// Area: Community & Cross-cutting
// Used by: POST /api/reports (body)
// Requirements: GEN-09

export class CreateReportDto {
  @IsEnum(ContentType, {
    message: 'contentType must be one of: post, comment, review, itinerary',
  })
  contentType: ContentType;

  @IsMongoId({
    message: 'contentId must be a valid ObjectId',
  })
  contentId: string;

  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason: string;
}

export class CreateContentReportDto {
  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason: string;
}
