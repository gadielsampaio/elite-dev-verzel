import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class SearchCatalogDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(0, 100)
  q = '';

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([
    'Painting',
    'Drawing',
    'Sculpture',
    'Photograph',
    'Print',
    'Ceramic',
    'Textile',
    'Jewelry',
    'Furniture and woodwork',
  ])
  type?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}
