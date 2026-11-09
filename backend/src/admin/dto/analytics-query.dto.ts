import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BookingStatus, ProviderType } from '../../common/enums';

// Area: Auth & Accounts (bonus)
// Used by: GET /api/admin/analytics (query)
// Requirements: BON-01, ACC-17, GEN-05

export enum AnalyticsDateFilterBy {
  Created = 'created',
  Travel = 'travel',
}

export class AnalyticsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProviderType, {
    message: 'type must be a valid provider type (airline or hotel)',
  })
  type?: ProviderType;

  @IsOptional()
  @IsMongoId({
    message: 'providerId must be a valid MongoDB ObjectId',
  })
  providerId?: string;

  @IsOptional()
  @IsEnum(BookingStatus, {
    message: 'status must be a valid booking status',
  })
  status?: BookingStatus;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be a date (YYYY-MM-DD)',
  })
  @IsDateString(
    { strict: true },
    { message: 'from must be a date (YYYY-MM-DD)' },
  )
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be a date (YYYY-MM-DD)',
  })
  @IsDateString({ strict: true }, { message: 'to must be a date (YYYY-MM-DD)' })
  to?: string;

  @IsOptional()
  @IsEnum(AnalyticsDateFilterBy, {
    message: 'dateBy must be either created or travel',
  })
  dateBy?: AnalyticsDateFilterBy;
}
