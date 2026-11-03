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

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeTags(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const tags: unknown[] = value;
  return tags.map((tag) =>
    typeof tag === 'string' ? tag.trim().toLowerCase() : tag,
  );
}

// Area: Community & Cross-cutting
// Used by: POST /api/posts (body), BLG-01.
export class CreatePostDto {
  @Transform(({ value }: TransformFnParams) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @Transform(({ value }: TransformFnParams) => trimString(value))
  @IsString()
  @MinLength(1)
  body: string;

  @IsEnum(PostStatus)
  status: PostStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: TransformFnParams) => normalizeTags(value))
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}
