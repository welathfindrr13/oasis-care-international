import { Field, ID, InputType } from '@nestjs/graphql';
import { ConcernOutcome } from '../../dto/carebridge.enums';

@InputType()
export class ResolveConcernInput {
  @Field(() => ID)
  concernId!: string;

  @Field(() => ConcernOutcome)
  outcome!: ConcernOutcome;

  @Field()
  resolutionSummary!: string;

  @Field(() => Boolean, { nullable: true })
  familySatisfied?: boolean;
}
