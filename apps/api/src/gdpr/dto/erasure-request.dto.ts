import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ErasureRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  requestType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
