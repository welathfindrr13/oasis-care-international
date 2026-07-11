import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON, GraphQLJSONObject } from 'graphql-type-json';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  AccessGrantScope,
  CareRoomMembershipStatus,
  CareRoomRole,
  CareRoomStatus,
  CarebridgeContentStatus,
  ConcernCategory,
  ConcernEventType,
  ConcernOutcome,
  ConcernPriority,
  ConcernSeverity,
  ConcernStatus,
  FamilyAccessBasis,
  FamilyPulseSentiment,
} from '@oasis/db';

registerEnumType(AccessGrantScope, { name: 'AccessGrantScope' });
registerEnumType(CareRoomMembershipStatus, { name: 'CareRoomMembershipStatus' });
registerEnumType(CareRoomRole, { name: 'CareRoomRole' });
registerEnumType(CareRoomStatus, { name: 'CareRoomStatus' });
registerEnumType(CarebridgeContentStatus, { name: 'CarebridgeContentStatus' });
registerEnumType(ConcernCategory, { name: 'ConcernCategory' });
registerEnumType(ConcernEventType, { name: 'ConcernEventType' });
registerEnumType(ConcernOutcome, { name: 'ConcernOutcome' });
registerEnumType(ConcernPriority, { name: 'ConcernPriority' });
registerEnumType(ConcernSeverity, { name: 'ConcernSeverity' });
registerEnumType(ConcernStatus, { name: 'ConcernStatus' });
registerEnumType(FamilyAccessBasis, { name: 'FamilyAccessBasis' });
registerEnumType(FamilyPulseSentiment, { name: 'FamilyPulseSentiment' });

@ObjectType()
export class CarebridgeClientDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  fullName!: string;
}

@ObjectType()
export class FamilyContactDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  fullName!: string;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  relationship?: string | null;
}

@ObjectType()
export class AccessGrantDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => AccessGrantScope)
  scope!: AccessGrantScope;

  @Field()
  grantedAt!: Date;

  @Field(() => Date, { nullable: true })
  revokedAt?: Date | null;
}

@ObjectType()
export class CareRoomMembershipDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  invitationId?: string | null;

  @Field(() => CareRoomRole)
  role!: CareRoomRole;

  @Field(() => CareRoomMembershipStatus)
  status!: CareRoomMembershipStatus;

  @Field(() => FamilyAccessBasis)
  accessBasis!: FamilyAccessBasis;

  @Field(() => Date, { nullable: true })
  reviewDueAt?: Date | null;

  @Field(() => FamilyContactDTO)
  familyContact!: FamilyContactDTO;

  @Field(() => [AccessGrantDTO])
  accessGrants!: AccessGrantDTO[];

  @Field(() => String, { nullable: true })
  invitationStatus?: string | null;

  @Field(() => String, { nullable: true })
  deliveryStatus?: string | null;

  @Field(() => String, { nullable: true })
  cleanupStatus?: string | null;

  @Field(() => Date, { nullable: true })
  invitationExpiresAt?: Date | null;
}

@ObjectType()
export class CareBridgePolicyDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  showVisitTimesDefault!: boolean;

  @Field()
  showTaskSummaryDefault!: boolean;

  @Field()
  showMedicationSupportDefault!: boolean;

  @Field()
  requireApprovalForAllContent!: boolean;

  @Field()
  familyCanRaiseConcerns!: boolean;

  @Field()
  familyCanReplyToConcerns!: boolean;

  @Field()
  familyCanSubmitPulse!: boolean;
}

@ObjectType()
export class CareRoomDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => CareRoomStatus)
  status!: CareRoomStatus;

  @Field(() => CarebridgeClientDTO)
  client!: CarebridgeClientDTO;

  @Field(() => [CareRoomMembershipDTO])
  memberships!: CareRoomMembershipDTO[];

  @Field(() => CareBridgePolicyDTO, { nullable: true })
  policy?: CareBridgePolicyDTO | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class FamilyCareRoomDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  clientDisplayName!: string;
}

@ObjectType()
export class FamilyVerifiedVisitStoryDTO {
  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field()
  publishedAt!: Date;
}

@ObjectType()
export class VerifiedVisitStoryDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => CarebridgeContentStatus)
  status!: CarebridgeContentStatus;

  @Field()
  draftTitle!: string;

  @Field()
  draftBody!: string;

  @Field(() => String, { nullable: true })
  approvedTitle?: string | null;

  @Field(() => String, { nullable: true })
  approvedBody?: string | null;

  @Field(() => Int, { nullable: true })
  familySafeVersion?: number | null;

  @Field(() => String, { nullable: true })
  familySafeTitle?: string | null;

  @Field(() => String, { nullable: true })
  familySafeBody?: string | null;

  @Field(() => Date, { nullable: true })
  approvedAt?: Date | null;

  @Field(() => String, { nullable: true })
  rejectionReason?: string | null;

  @Field(() => Date, { nullable: true })
  rejectedAt?: Date | null;

  @Field(() => GraphQLJSON)
  sourceRefs!: unknown;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;
}

@ObjectType()
export class ConcernMessageDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  body!: string;

  @Field()
  actorLabel!: string;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class ConcernEventDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => ConcernEventType)
  eventType!: ConcernEventType;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class ConcernDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  careRoomId!: string;

  @Field()
  clientId!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => ConcernSeverity)
  severity!: ConcernSeverity;

  @Field(() => ConcernPriority)
  priority!: ConcernPriority;

  @Field(() => ConcernCategory)
  category!: ConcernCategory;

  @Field(() => ConcernStatus)
  status!: ConcernStatus;

  @Field(() => ConcernOutcome, { nullable: true })
  outcome?: ConcernOutcome | null;

  @Field(() => Date, { nullable: true })
  acknowledgementDueAt?: Date | null;

  @Field(() => Date, { nullable: true })
  acknowledgedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  responseDueAt?: Date | null;

  @Field(() => Date, { nullable: true })
  resolutionDueAt?: Date | null;

  @Field(() => Date, { nullable: true })
  resolvedAt?: Date | null;

  @Field(() => [ConcernMessageDTO])
  messages!: ConcernMessageDTO[];

  @Field(() => [ConcernEventDTO])
  events!: ConcernEventDTO[];
}

@ObjectType()
export class FamilyConcernReceiptDTO {
  @Field()
  title!: string;

  @Field(() => ConcernStatus)
  status!: ConcernStatus;
}

@ObjectType()
export class FamilyPulseDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => FamilyPulseSentiment)
  sentiment!: FamilyPulseSentiment;

  @Field(() => String, { nullable: true })
  note?: string | null;

  @Field()
  createdAt!: Date;
}

@InputType()
export class CreateCareRoomInput {
  @Field()
  clientId!: string;
}

@InputType()
export class InviteFamilyContactInput {
  @Field()
  @IsUUID()
  careRoomId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @Field()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;

  @Field(() => CareRoomRole)
  @IsEnum(CareRoomRole)
  role!: CareRoomRole;

  @Field(() => FamilyAccessBasis)
  @IsEnum(FamilyAccessBasis)
  accessBasis!: FamilyAccessBasis;
}

@InputType()
export class UpdateFamilyAccessGrantsInput {
  @Field(() => ID)
  @IsUUID()
  careRoomMembershipId!: string;

  @Field(() => [AccessGrantScope])
  @IsArray()
  @ArrayUnique()
  @IsEnum(AccessGrantScope, { each: true })
  scopes!: AccessGrantScope[];
}

@InputType()
export class FamilyMembershipActionInput {
  @Field(() => ID)
  @IsUUID()
  careRoomMembershipId!: string;
}

@InputType()
export class FamilyInvitationActionInput {
  @Field(() => ID)
  @IsUUID()
  invitationId!: string;
}

@InputType()
export class UpdateCarebridgePolicyInput {
  @Field()
  careRoomId!: string;

  @Field(() => Boolean, { nullable: true })
  showVisitTimesDefault?: boolean;

  @Field(() => Boolean, { nullable: true })
  showTaskSummaryDefault?: boolean;

  @Field(() => Boolean, { nullable: true })
  showMedicationSupportDefault?: boolean;

  @Field(() => Boolean, { nullable: true })
  requireApprovalForAllContent?: boolean;
}

@InputType()
export class RaiseConcernInput {
  @Field()
  careRoomId!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ConcernSeverity)
  severity!: ConcernSeverity;

  @Field(() => ConcernCategory)
  category!: ConcernCategory;
}

@InputType()
export class UpdateConcernStatusInput {
  @Field()
  concernId!: string;

  @Field(() => ConcernStatus)
  status!: ConcernStatus;

  @Field(() => ConcernOutcome, { nullable: true })
  outcome?: ConcernOutcome;

  @Field(() => String, { nullable: true })
  message?: string;
}

@InputType()
export class RejectVerifiedVisitStoryInput {
  @Field()
  storyId!: string;

  @Field()
  rejectionReason!: string;
}

@InputType()
export class SubmitFamilyPulseInput {
  @Field()
  careRoomId!: string;

  @Field(() => FamilyPulseSentiment)
  sentiment!: FamilyPulseSentiment;

  @Field(() => String, { nullable: true })
  note?: string;
}
