import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto';
import { FavouriteType } from '../schemas/favourite.schema';

export class ListFavouritesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FavouriteType)
  type?: FavouriteType;
}
