import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Area: Community & Cross-cutting
// Used by: PATCH /api/comments/:id (body), BLG-07.
export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/\S/, { message: 'text must contain a non-whitespace character' })
  text: string;
}
