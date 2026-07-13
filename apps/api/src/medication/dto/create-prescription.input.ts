import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  Matches,
  Min,
  Max,
} from 'class-validator';
import {
  MEDICATION_WALL_TIME_PATTERN,
  medicationWallTimeUniquenessKey,
} from '../medication-wall-time';

@InputType()
export class CreatePrescriptionInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  medicationId: string;

  @Field()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @Field({ nullable: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  endDate?: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(12)
  frequencyPerDay: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(24)
  frequencyIntervalHours?: number;

  @Field(() => [String])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique(medicationWallTimeUniquenessKey)
  @IsString({ each: true })
  @Matches(MEDICATION_WALL_TIME_PATTERN, { each: true })
  administrationTimes: string[];

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
