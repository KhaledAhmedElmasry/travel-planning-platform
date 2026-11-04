import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    minLength: 1,
    maxLength: 500,
    example: 'Thanks, this helped me plan my trip!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/\S/, { message: 'text must contain a non-whitespace character' })
  text: string;
}
