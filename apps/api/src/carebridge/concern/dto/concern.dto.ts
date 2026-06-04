import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  ConcernCategory,
  ConcernEventType,
  ConcernOutcome,
  ConcernPriority,
  ConcernSeverity,
  ConcernStatus,
} from '../../dto/carebridge.enums';

@ObjectType()
export class ConcernMessageDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  body!: string;

  @Field()
  actorType!: string;

  @Field(() => String, { nullable: true })
  actorLabel?: string | null;

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
  actorType!: string;

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

  @Field(() => ConcernCategory)
  category!: ConcernCategory;

  @Field(() => ConcernSeverity)
  severity!: ConcernSeverity;

  @Field(() => ConcernPriority)
  priority!: ConcernPriority;

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
