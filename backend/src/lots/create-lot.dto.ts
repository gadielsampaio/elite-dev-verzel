import { Transform } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  ValidateIf,
  IsISO8601,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const money = /^(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/;
const timezone = /(?:Z|[+-]\d{2}:\d{2})$/;

export class CreateLotDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  artworkId!: number;

  @IsString()
  @Matches(money)
  startingBid!: string;

  @IsString()
  @Matches(money)
  bidIncrement!: string;

  @IsString()
  @Matches(money)
  estimatedValue!: string;

  @IsOptional()
  @IsIn(['now', 'scheduled'])
  startMode?: 'now' | 'scheduled';

  @ValidateIf(
    (data: CreateLotDto) =>
      data.startMode !== 'now' || data.startTime !== undefined,
  )
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezone)
  startTime?: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(timezone)
  endTime!: string;
}
