import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { CarePlanStatus } from '@oasis/db';

registerEnumType(CarePlanStatus, {
  name: 'CarePlanStatus',
  description: 'The lifecycle state of a care-plan version',
});

@ObjectType()
export class CarePlanListSectionDTO {
  @Field(() => [String])
  items!: string[];
}

@ObjectType()
export class CarePlanOverviewDTO {
  @Field()
  summary!: string;

  @Field(() => [String])
  strengths!: string[];

  @Field(() => [String])
  preferences!: string[];
}

@ObjectType()
export class CarePlanGoalsAndOutcomesDTO {
  @Field(() => [String])
  goals!: string[];

  @Field(() => [String])
  desiredOutcomes!: string[];
}

@ObjectType()
export class CarePlanDailyRoutinesDTO {
  @Field()
  morning!: string;

  @Field()
  midday!: string;

  @Field()
  evening!: string;

  @Field()
  overnight!: string;
}

@ObjectType()
export class CarePlanPersonalCareSupportDTO {
  @Field()
  bathing!: string;

  @Field()
  dressing!: string;

  @Field()
  toileting!: string;

  @Field()
  grooming!: string;
}

@ObjectType()
export class CarePlanMobilityAndTransfersDTO {
  @Field()
  mobilitySummary!: string;

  @Field()
  transferGuidance!: string;

  @Field(() => [String])
  equipment!: string[];
}

@ObjectType()
export class CarePlanNutritionAndHydrationDTO {
  @Field()
  nutritionSummary!: string;

  @Field()
  hydrationSupport!: string;

  @Field(() => [String])
  dietaryNeeds!: string[];
}

@ObjectType()
export class CarePlanMedicationSupportDTO {
  @Field()
  levelOfSupport!: string;

  @Field()
  keyInstructions!: string;

  @Field()
  refusalEscalation!: string;
}

@ObjectType()
export class CarePlanCommunicationAndAccessibilityDTO {
  @Field()
  communicationApproach!: string;

  @Field(() => [String])
  communicationNeeds!: string[];

  @Field(() => [String])
  accessibilityAdjustments!: string[];
}

@ObjectType()
export class CarePlanRiskAndRedFlagItemDTO {
  @Field()
  title!: string;

  @Field()
  guidance!: string;

  @Field(() => String, { nullable: true })
  escalationTrigger?: string | null;
}

@ObjectType()
export class CarePlanRisksAndRedFlagsDTO {
  @Field(() => [CarePlanRiskAndRedFlagItemDTO])
  items!: CarePlanRiskAndRedFlagItemDTO[];
}

@ObjectType()
export class CarePlanContingencyAndEscalationDTO {
  @Field()
  summary!: string;

  @Field(() => [String])
  actions!: string[];

  @Field(() => [String])
  escalationTriggers!: string[];
}

@ObjectType()
export class CarePlanRepresentativesAndInvolvementDTO {
  @Field()
  summary!: string;

  @Field(() => [String])
  involvedPeople!: string[];
}

@ObjectType()
export class CarePlanContentDTO {
  @Field(() => CarePlanOverviewDTO)
  overview!: CarePlanOverviewDTO;

  @Field(() => CarePlanGoalsAndOutcomesDTO)
  goalsAndOutcomes!: CarePlanGoalsAndOutcomesDTO;

  @Field(() => CarePlanDailyRoutinesDTO)
  dailyRoutines!: CarePlanDailyRoutinesDTO;

  @Field(() => CarePlanPersonalCareSupportDTO)
  personalCareSupport!: CarePlanPersonalCareSupportDTO;

  @Field(() => CarePlanMobilityAndTransfersDTO)
  mobilityAndTransfers!: CarePlanMobilityAndTransfersDTO;

  @Field(() => CarePlanNutritionAndHydrationDTO)
  nutritionAndHydration!: CarePlanNutritionAndHydrationDTO;

  @Field(() => CarePlanMedicationSupportDTO)
  medicationSupport!: CarePlanMedicationSupportDTO;

  @Field(() => CarePlanCommunicationAndAccessibilityDTO)
  communicationAndAccessibility!: CarePlanCommunicationAndAccessibilityDTO;

  @Field(() => CarePlanRisksAndRedFlagsDTO)
  risksAndRedFlags!: CarePlanRisksAndRedFlagsDTO;

  @Field(() => CarePlanContingencyAndEscalationDTO)
  contingencyAndEscalation!: CarePlanContingencyAndEscalationDTO;

  @Field(() => CarePlanRepresentativesAndInvolvementDTO)
  representativesAndInvolvement!: CarePlanRepresentativesAndInvolvementDTO;
}

@ObjectType()
export class CarePlanVersionDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  carePlanId!: string;

  @Field()
  versionNumber!: number;

  @Field(() => CarePlanStatus)
  status!: CarePlanStatus;

  @Field(() => Date, { nullable: true })
  reviewDueAt?: Date | null;

  @Field(() => Date, { nullable: true })
  effectiveFrom?: Date | null;

  @Field()
  authoredBy!: string;

  @Field(() => String, { nullable: true })
  approvedBy?: string | null;

  @Field(() => Date, { nullable: true })
  approvedAt?: Date | null;

  @Field(() => CarePlanContentDTO)
  content!: CarePlanContentDTO;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
export class CarePlanDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  clientId!: string;

  @Field(() => CarePlanVersionDTO, { nullable: true })
  activeVersion?: CarePlanVersionDTO | null;

  @Field(() => CarePlanVersionDTO, { nullable: true })
  draftVersion?: CarePlanVersionDTO | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
