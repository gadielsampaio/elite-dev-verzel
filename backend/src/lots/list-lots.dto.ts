import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';

export class ListLotsDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['scheduled', 'open', 'closed'])
  status?: 'scheduled' | 'open' | 'closed';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}
