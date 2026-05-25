import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

export enum AssessmentStatusGQL {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum AssessmentSourceGQL {
  MANUAL = 'MANUAL',
  VISIT_REVIEW = 'VISIT_REVIEW',
  HOSPITAL_DISCHARGE = 'HOSPITAL_DISCHARGE',
  REFERRAL_HANDOFF = 'REFERRAL_HANDOFF',
}

export enum CarePlanStatusGQL {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

export enum EvidencePackStatusGQL {
  DRAFT = 'DRAFT',
  COMPILED = 'COMPILED',
  PUBLISHED = 'PUBLISHED',
}

export enum EvidenceSourceTypeGQL {
  VISIT = 'VISIT',
  CARE_LOG = 'CARE_LOG',
  MEDICATION_ADMINISTRATION = 'MEDICATION_ADMINISTRATION',
  ASSESSMENT = 'ASSESSMENT',
  CARE_PLAN = 'CARE_PLAN',
  CONCERN = 'CONCERN',
  MANUAL_NOTE = 'MANUAL_NOTE',
}

registerEnumType(AssessmentStatusGQL, { name: 'AssessmentStatus' });
registerEnumType(AssessmentSourceGQL, { name: 'AssessmentSource' });
registerEnumType(CarePlanStatusGQL, { name: 'CarePlanStatus' });
registerEnumType(EvidencePackStatusGQL, { name: 'EvidencePackStatus' });
registerEnumType(EvidenceSourceTypeGQL, { name: 'EvidenceSourceType' });

@ObjectType()
export class AssessmentDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  organizationId?: string | null;

  @Field(() => String)
  clientId!: string;

  @Field(() => String, { nullable: true })
  visitId?: string | null;

  @Field(() => AssessmentStatusGQL)
  status!: AssessmentStatusGQL;

  @Field(() => AssessmentSourceGQL)
  source!: AssessmentSourceGQL;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  summary?: string | null;

  @Field(() => GraphQLJSONObject)
  findings!: Record<string, unknown>;

  @Field(() => GraphQLJSONObject, { nullable: true })
  riskFlags?: Record<string, unknown> | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  recommendedActions?: Record<string, unknown> | null;

  @Field(() => String, { nullable: true })
  assessorId?: string | null;

  @Field(() => Date, { nullable: true })
  completedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  reviewDueAt?: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
export class CarePlanDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  organizationId?: string | null;

  @Field(() => String)
  clientId!: string;

  @Field(() => String, { nullable: true })
  assessmentId?: string | null;

  @Field(() => CarePlanStatusGQL)
  status!: CarePlanStatusGQL;

  @Field(() => Number)
  version!: number;

  @Field(() => String)
  title!: string;

  @Field(() => GraphQLJSONObject)
  goals!: Record<string, unknown>;

  @Field(() => GraphQLJSONObject)
  interventions!: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  safetyNotes?: string | null;

  @Field(() => Date)
  effectiveFrom!: Date;

  @Field(() => Date, { nullable: true })
  effectiveTo?: Date | null;

  @Field(() => Date, { nullable: true })
  reviewDueAt?: Date | null;

  @Field(() => String, { nullable: true })
  authoredById?: string | null;

  @Field(() => String, { nullable: true })
  approvedById?: string | null;

  @Field(() => Date, { nullable: true })
  approvedAt?: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
export class EvidenceItemDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  evidencePackId!: string;

  @Field(() => EvidenceSourceTypeGQL)
  sourceType!: EvidenceSourceTypeGQL;

  @Field(() => String, { nullable: true })
  sourceId?: string | null;

  @Field(() => Date, { nullable: true })
  occurredAt?: Date | null;

  @Field(() => String)
  headline!: string;

  @Field(() => String, { nullable: true })
  detail?: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata?: Record<string, unknown> | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
export class EvidencePackDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  organizationId?: string | null;

  @Field(() => String)
  clientId!: string;

  @Field(() => String, { nullable: true })
  carePlanId?: string | null;

  @Field(() => EvidencePackStatusGQL)
  status!: EvidencePackStatusGQL;

  @Field(() => String)
  kind!: string;

  @Field(() => Date)
  periodStart!: Date;

  @Field(() => Date)
  periodEnd!: Date;

  @Field(() => GraphQLJSONObject, { nullable: true })
  summary?: Record<string, unknown> | null;

  @Field(() => GraphQLJSONObject)
  sourceRefs!: Record<string, unknown>;

  @Field(() => String)
  generatedBy!: string;

  @Field(() => Date)
  generatedAt!: Date;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;

  @Field(() => [EvidenceItemDTO])
  items!: EvidenceItemDTO[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
