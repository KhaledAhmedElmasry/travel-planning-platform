import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PostStatus } from '../schemas/post.schema';

// Area: Community & Cross-cutting
// Used by: GET /api/posts/mine (query), BLG-03.
export class ListMyPostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}
