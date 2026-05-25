import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class PublishVerifiedVisitStoryInput {
  @Field(() => ID)
  storyId!: string;

  @Field(() => String, { nullable: true })
  approvedTitle?: string;

  @Field(() => String, { nullable: true })
  approvedBody?: string;
}
