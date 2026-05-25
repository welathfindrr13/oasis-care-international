import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import {
  AccessGrantScope,
  CareRoomMembershipStatus,
  CareRoomRole,
  CareRoomStatus,
  FamilyAccessBasis,
} from '../../dto/carebridge.enums';

@ObjectType()
export class FamilyContactDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  fullName!: string;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

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
}

@ObjectType()
export class CareBridgePolicyDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  requireApprovalForAllContent!: boolean;

  @Field()
  familyCanRaiseConcerns!: boolean;

  @Field()
  familyCanReplyToConcerns!: boolean;

  @Field()
  allowMedicationSupportStatus!: boolean;

  @Field(() => GraphQLJSONObject, { nullable: true })
  policyScope?: Record<string, unknown> | null;
}

@ObjectType()
export class CareRoomDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  clientId!: string;

  @Field(() => CareRoomStatus)
  status!: CareRoomStatus;

  @Field(() => [CareRoomMembershipDTO])
  memberships!: CareRoomMembershipDTO[];

  @Field(() => CareBridgePolicyDTO, { nullable: true })
  effectivePolicy?: CareBridgePolicyDTO | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
