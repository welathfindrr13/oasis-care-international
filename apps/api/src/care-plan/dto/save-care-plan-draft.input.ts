import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

@InputType()
export class CarePlanOverviewInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  strengths?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  preferences?: string[];
}

@InputType()
export class CarePlanGoalsAndOutcomesInput {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  goals?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  desiredOutcomes?: string[];
}

@InputType()
export class CarePlanDailyRoutinesInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  morning?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  midday?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evening?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  overnight?: string;
}

@InputType()
export class CarePlanPersonalCareSupportInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bathing?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dressing?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  toileting?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  grooming?: string;
}

@InputType()
export class CarePlanMobilityAndTransfersInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mobilitySummary?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  transferGuidance?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  equipment?: string[];
}

@InputType()
export class CarePlanNutritionAndHydrationInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nutritionSummary?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hydrationSupport?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  dietaryNeeds?: string[];
}

@InputType()
export class CarePlanMedicationSupportInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  levelOfSupport?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  keyInstructions?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refusalEscalation?: string;
}

@InputType()
export class CarePlanCommunicationAndAccessibilityInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  communicationApproach?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  communicationNeeds?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  accessibilityAdjustments?: string[];
}

@InputType()
export class CarePlanRiskAndRedFlagItemInput {
  @Field()
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field()
  @IsString()
  @MaxLength(2000)
  guidance!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  escalationTrigger?: string;
}

@InputType()
export class CarePlanRisksAndRedFlagsInput {
  @Field(() => [CarePlanRiskAndRedFlagItemInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CarePlanRiskAndRedFlagItemInput)
  @ArrayMaxSize(12)
  items?: CarePlanRiskAndRedFlagItemInput[];
}

@InputType()
export class CarePlanContingencyAndEscalationInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  actions?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  escalationTriggers?: string[];
}

@InputType()
export class CarePlanRepresentativesAndInvolvementInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  involvedPeople?: string[];
}

@InputType()
export class CarePlanContentInput {
  @Field(() => CarePlanOverviewInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanOverviewInput)
  overview?: CarePlanOverviewInput;

  @Field(() => CarePlanGoalsAndOutcomesInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanGoalsAndOutcomesInput)
  goalsAndOutcomes?: CarePlanGoalsAndOutcomesInput;

  @Field(() => CarePlanDailyRoutinesInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanDailyRoutinesInput)
  dailyRoutines?: CarePlanDailyRoutinesInput;

  @Field(() => CarePlanPersonalCareSupportInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanPersonalCareSupportInput)
  personalCareSupport?: CarePlanPersonalCareSupportInput;

  @Field(() => CarePlanMobilityAndTransfersInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanMobilityAndTransfersInput)
  mobilityAndTransfers?: CarePlanMobilityAndTransfersInput;

  @Field(() => CarePlanNutritionAndHydrationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanNutritionAndHydrationInput)
  nutritionAndHydration?: CarePlanNutritionAndHydrationInput;

  @Field(() => CarePlanMedicationSupportInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanMedicationSupportInput)
  medicationSupport?: CarePlanMedicationSupportInput;

  @Field(() => CarePlanCommunicationAndAccessibilityInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanCommunicationAndAccessibilityInput)
  communicationAndAccessibility?: CarePlanCommunicationAndAccessibilityInput;

  @Field(() => CarePlanRisksAndRedFlagsInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanRisksAndRedFlagsInput)
  risksAndRedFlags?: CarePlanRisksAndRedFlagsInput;

  @Field(() => CarePlanContingencyAndEscalationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanContingencyAndEscalationInput)
  contingencyAndEscalation?: CarePlanContingencyAndEscalationInput;

  @Field(() => CarePlanRepresentativesAndInvolvementInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CarePlanRepresentativesAndInvolvementInput)
  representativesAndInvolvement?: CarePlanRepresentativesAndInvolvementInput;
}

@InputType()
export class SaveCarePlanDraftInput {
  @Field(() => ID)
  @IsUUID()
  clientId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  reviewDueAt?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @Field(() => CarePlanContentInput)
  @ValidateNested()
  @Type(() => CarePlanContentInput)
  content!: CarePlanContentInput;
}
