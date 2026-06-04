import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class UpsertCarebridgePolicyInput {
  @Field(() => ID, { nullable: true })
  careRoomId?: string;

  @Field(() => ID, { nullable: true })
  clientId?: string;

  @Field({ nullable: true })
  requireApprovalForAllContent?: boolean;

  @Field({ nullable: true })
  familyCanRaiseConcerns?: boolean;

  @Field({ nullable: true })
  familyCanReplyToConcerns?: boolean;

  @Field({ nullable: true })
  allowMedicationSupportStatus?: boolean;
}
