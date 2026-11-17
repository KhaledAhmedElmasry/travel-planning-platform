import { IsEnum, IsMongoId } from 'class-validator';
import { FavouriteType } from '../schemas/favourite.schema';

export class AddFavouriteDto {
  @IsEnum(FavouriteType)
  type: FavouriteType;

  @IsMongoId()
  targetId: string;
}
