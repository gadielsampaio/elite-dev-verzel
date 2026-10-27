import { IsString, IsUUID, Matches } from 'class-validator';

export class DepositDto {
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/)
  amount!: string;

  @IsUUID()
  idempotencyKey!: string;
}
