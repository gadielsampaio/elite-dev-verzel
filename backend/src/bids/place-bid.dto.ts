import { IsString, IsUUID, Matches } from 'class-validator';
export class PlaceBidDto {
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/)
  amount!: string;

  @IsUUID()
  idempotencyKey!: string;
}
