import { Field, ID, InputType } from '@nestjs/graphql';
import { ConcernCategory, ConcernPriority, ConcernSeverity } from '../../dto/carebridge.enums';

@InputType()
export class RaiseConcernInput {
  @Field(() => ID)
  careRoomId!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ConcernCategory)
  category!: ConcernCategory;

  @Field(() => ConcernSeverity)
  severity!: ConcernSeverity;

  @Field(() => ConcernPriority, { nullable: true })
  priority?: ConcernPriority;

  @Field(() => String, { nullable: true })
  messageBody?: string;
}
