import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AccountStatus, Role } from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// Area: Auth & Accounts
// Used by: GET /api/admin/accounts (query)
// Requirements: ACC-14, GEN-05

export class ListAccountsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Role, {
    message: `role must be one of: ${Object.values(Role).join(', ')}`,
  })
  role?: Role;

  @IsOptional()
  @IsEnum(AccountStatus, {
    message: `status must be one of: ${Object.values(AccountStatus).join(', ')}`,
  })
  status?: AccountStatus;
}
