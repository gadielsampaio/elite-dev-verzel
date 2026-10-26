import { Transform } from 'class-transformer';
import { IsString, Length, ValidateIf } from 'class-validator';

export class CancelLotDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  reason?: string;
}
