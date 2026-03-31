import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SarRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  requestType?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;
}
