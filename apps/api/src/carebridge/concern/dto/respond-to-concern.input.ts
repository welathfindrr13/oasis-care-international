import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class RespondToConcernInput {
  @Field(() => ID)
  concernId!: string;

  @Field()
  body!: string;
}
