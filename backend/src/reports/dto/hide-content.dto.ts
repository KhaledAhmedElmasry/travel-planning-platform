import { IsOptional, IsString, MaxLength } from 'class-validator';

// Area: Community & Cross-cutting
// Used by: PATCH /api/admin/content/:type/:id/hide (body)
// Requirements: GEN-10

export class HideContentDto {
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}
