import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto';
import { FavouriteType } from '../schemas/favourite.schema';

export class ListFavouritesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FavouriteType)
  type?: FavouriteType;

  // BON-02: is this item saved? ?type=hotel&targetId=<id> gives 0 or 1 favourite (with its id).
  @IsOptional()
  @IsMongoId()
  targetId?: string;
}
