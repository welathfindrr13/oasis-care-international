import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class AcknowledgeConcernInput {
  @Field(() => ID)
  concernId!: string;

  @Field(() => String, { nullable: true })
  assignedToUserId?: string;
}
