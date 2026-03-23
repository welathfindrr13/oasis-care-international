import { InputType, Field, Int, ID } from '@nestjs/graphql';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsArray,
  IsBoolean,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

@InputType()
export class UpdatePrescriptionInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  id: string;

  @Field()
  @IsDateString()
  startDate: string;

  @Field({ nullable: true })
  @IsDateString()
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
  @IsString({ each: true })
  administrationTimes: string[];

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @Field()
  @IsBoolean()
  isActive: boolean;
}
