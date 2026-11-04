import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

// Area: Community & Cross-cutting
// Used by: PATCH /api/admin/reports/:id (body)
// Requirements: GEN-10

export enum ReportResolutionAction {
  Dismiss = 'dismiss',
  Hide = 'hide',
  Delete = 'delete',
}

export class ResolveReportDto {
  @IsEnum(ReportResolutionAction, {
    message: 'action must be one of: dismiss, hide, delete',
  })
  action: ReportResolutionAction;

  @IsOptional()
  @IsString({ message: 'note must be a string' })
  @MaxLength(500, { message: 'note must not exceed 500 characters' })
  note?: string;
}
