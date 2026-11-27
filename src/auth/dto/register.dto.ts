import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({ require_tld: false })
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(1024)
  password!: string;
}
