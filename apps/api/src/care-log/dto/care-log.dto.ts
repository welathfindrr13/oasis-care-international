import { Field, GraphQLISODateTime, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { CareLogCategory, IntakeAmount, MoodLevel, StoolType } from '@oasis/db';

registerEnumType(CareLogCategory, { name: 'CareLogCategory' });
registerEnumType(IntakeAmount, { name: 'IntakeAmount' });
registerEnumType(MoodLevel, { name: 'MoodLevel' });
registerEnumType(StoolType, { name: 'StoolType' });

@ObjectType()
export class CareLogDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  clientId!: string;

  @Field(() => ID)
  carerId!: string;

  @Field(() => ID, { nullable: true })
  visitId?: string | null;

  @Field(() => ID, { nullable: true })
  medicationAdministrationId?: string | null;

  @Field(() => GraphQLISODateTime)
  occurredAt!: Date;

  @Field(() => CareLogCategory)
  category!: CareLogCategory;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field(() => Boolean, { nullable: true })
  urinePassed?: boolean | null;

  @Field(() => Boolean, { nullable: true })
  bowelMovement?: boolean | null;

  @Field(() => StoolType, { nullable: true })
  stoolType?: StoolType | null;

  @Field(() => String, { nullable: true })
  continenceStatus?: string | null;

  @Field(() => String, { nullable: true })
  assistanceLevel?: string | null;

  @Field(() => String, { nullable: true })
  mealType?: string | null;

  @Field(() => IntakeAmount, { nullable: true })
  intakeAmount?: IntakeAmount | null;

  @Field(() => Int, { nullable: true })
  fluidMl?: number | null;

  @Field(() => String, { nullable: true })
  appetite?: string | null;

  @Field(() => Boolean, { nullable: true })
  slept?: boolean | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  sleepStart?: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  sleepEnd?: Date | null;

  @Field(() => String, { nullable: true })
  sleepQuality?: string | null;

  @Field(() => MoodLevel, { nullable: true })
  moodLevel?: MoodLevel | null;

  @Field(() => Boolean, { nullable: true })
  agitation?: boolean | null;

  @Field(() => Boolean, { nullable: true })
  confusion?: boolean | null;

  @Field(() => Int, { nullable: true })
  painScore?: number | null;

  @Field(() => Boolean)
  escalated!: boolean;

  @Field(() => String, { nullable: true })
  escalatedTo?: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  escalatedAt?: Date | null;

  @Field(() => String, { nullable: true })
  source?: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class CareLogPaginatedResponse {
  @Field(() => [CareLogDTO])
  items!: CareLogDTO[];

  @Field(() => Int)
  total!: number;
}
