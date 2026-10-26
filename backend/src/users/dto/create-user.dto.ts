
import { IsEmail, IsEnum, IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { UserRole } from '../../generated/prisma/client.js';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
