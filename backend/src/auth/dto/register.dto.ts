import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsIn(['bidder', 'auctioneer'])
  role: 'bidder' | 'auctioneer';
}
