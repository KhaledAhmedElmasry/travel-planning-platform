import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Area: Community & Cross-cutting
// Used by: POST /api/posts/:id/comments (body)
// Requirements: BLG-05
export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/\S/, { message: 'text must contain a non-whitespace character' })
  text: string;
}
