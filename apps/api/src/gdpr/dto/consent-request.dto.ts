import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConsentRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  consentType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  purpose!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  legalBasis!: string;

  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
