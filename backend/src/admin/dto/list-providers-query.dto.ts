import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ProviderType } from '../../common/enums';

// Area: Admin, Notifications & Platform Core
// Used by: GET /api/admin/providers (query)
// Requirements: ACC-13, ACC-15, GEN-05 (new endpoint, MILESTONE2 spec section 8)

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ListProvidersQueryDto extends PaginationQueryDto {
  @IsEnum(ProviderType, { message: 'type must be airline or hotel' })
  type: ProviderType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'active must be true or false' })
  active?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'hasModerator must be true or false' })
  hasModerator?: boolean;
}
