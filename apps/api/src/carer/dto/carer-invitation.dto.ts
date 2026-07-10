import { Field, ID, InputType, ObjectType } from "@nestjs/graphql";
import { IsEmail, IsUUID, MaxLength } from "class-validator";

@InputType()
export class InviteCarerInput {
  @Field()
  @IsEmail()
  @MaxLength(320)
  emailAddress!: string;
}

@InputType()
export class CarerInvitationActionInput {
  @Field(() => ID)
  @IsUUID()
  invitationId!: string;
}

@InputType()
export class CarerMembershipActionInput {
  @Field(() => ID)
  @IsUUID()
  membershipId!: string;
}

@ObjectType()
export class CarerAccessLifecycleDTO {
  @Field()
  lifecycleId!: string;

  @Field(() => ID, { nullable: true })
  invitationId?: string | null;

  @Field(() => ID, { nullable: true })
  membershipId?: string | null;

  @Field(() => ID, { nullable: true })
  carerId?: string | null;

  @Field()
  emailAddress!: string;

  @Field()
  status!: string;

  @Field()
  readiness!: string;

  @Field()
  deliveryStatus!: string;

  @Field()
  cleanupStatus!: string;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  @Field()
  canRevoke!: boolean;

  @Field()
  canReissue!: boolean;

  @Field()
  canRetryDelivery!: boolean;

  @Field()
  canLink!: boolean;

  @Field()
  canDeactivate!: boolean;
}
