import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ShiftVerificationMethod } from '@oasis/db';

@InputType()
export class ClockOutInput {
  @Field(() => String)
  @IsUUID()
  shiftId!: string;

  @Field(() => ShiftVerificationMethod, { defaultValue: ShiftVerificationMethod.GPS })
  @IsEnum(ShiftVerificationMethod)
  method: ShiftVerificationMethod = ShiftVerificationMethod.GPS;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  accuracyMeters?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  source?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
