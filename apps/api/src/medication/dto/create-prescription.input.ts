import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, IsBoolean, IsDateString, Min, Max } from 'class-validator';

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

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
