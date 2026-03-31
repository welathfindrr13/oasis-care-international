import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GdprListQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number.parseInt(value, 10)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
