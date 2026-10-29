import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export class ResultsPageDto {
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

export class ParticipationPageDto extends ResultsPageDto {
  @IsIn(['all', 'wins'])
  filter: 'all' | 'wins' = 'all';
}
