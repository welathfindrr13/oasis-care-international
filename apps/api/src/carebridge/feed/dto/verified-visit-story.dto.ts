import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import { CarebridgeContentStatus } from '../../dto/carebridge.enums';

@ObjectType()
export class VerifiedVisitStoryDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  careRoomId!: string;

  @Field()
  clientId!: string;

  @Field()
  visitId!: string;

  @Field(() => CarebridgeContentStatus)
  status!: CarebridgeContentStatus;

  @Field()
  draftTitle!: string;

  @Field()
  draftBody!: string;

  @Field(() => String, { nullable: true })
  approvedTitle?: string | null;

  @Field(() => String, { nullable: true })
  approvedBody?: string | null;

  @Field(() => GraphQLJSONObject)
  sourceRefs!: unknown;

  @Field(() => Date, { nullable: true })
  approvedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;
}
