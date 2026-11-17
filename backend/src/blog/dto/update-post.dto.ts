import { Transform, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PostStatus } from '../schemas/post.schema';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeTags({ value }: TransformFnParams): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((tag: unknown) =>
    typeof tag === 'string' ? tag.trim().toLowerCase() : tag,
  );
}

// Area: Community & Cross-cutting
// Used by: PATCH /api/posts/:id (body); shared by BLG-04 and BLG-08.
// Keep every field in UpdatePostRequest so tag updates do not narrow the shared PATCH contract.
export class UpdatePostDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  body?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(normalizeTags)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PostStatus)
  status?: PostStatus;
}
