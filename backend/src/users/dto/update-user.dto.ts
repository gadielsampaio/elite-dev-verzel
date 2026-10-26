import { IsEmail, IsNotEmpty, ValidateIf, IsString } from 'class-validator';

export class UpdateUserDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEmail()
  email?: string;
}
