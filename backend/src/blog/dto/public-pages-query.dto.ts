import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Query parameters for independently paginated public Blog resources. */
export class PostDetailQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  commentsPage = 1;
}

export class PublicAuthorPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  postsPage = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itinerariesPage = 1;
}
