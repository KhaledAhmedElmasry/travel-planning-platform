import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// Used by: POST /api/reviews/:id/reply (body), HTL-26 (bonus).
export class ReplyReviewDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Reply text is required' })
  @IsNotEmpty({ message: 'Reply text is required' })
  @MaxLength(1000, { message: 'Reply text must be at most 1000 characters' })
  text: string;
}
