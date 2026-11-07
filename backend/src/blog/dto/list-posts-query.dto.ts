import { Transform, type TransformFnParams } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

function trimOptionalQuery({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Area: Community & Cross-cutting
// Used by: GET /api/posts (query), BLG-02/BLG-09.
export class ListPostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimOptionalQuery)
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(trimOptionalQuery)
  @IsString()
  tag?: string;
}
