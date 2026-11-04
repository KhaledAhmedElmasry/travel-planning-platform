import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

function parseBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class DeleteDayQueryDto {
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  confirm: boolean;
}
