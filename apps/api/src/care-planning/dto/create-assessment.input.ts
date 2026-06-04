import { Field, InputType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AssessmentSourceGQL, AssessmentStatusGQL } from './care-planning.dto';

@InputType()
export class CreateAssessmentInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  visitId?: string;

  @Field(() => AssessmentStatusGQL, { defaultValue: AssessmentStatusGQL.DRAFT })
  @IsEnum(AssessmentStatusGQL)
  status: AssessmentStatusGQL = AssessmentStatusGQL.DRAFT;

  @Field(() => AssessmentSourceGQL, { defaultValue: AssessmentSourceGQL.MANUAL })
  @IsEnum(AssessmentSourceGQL)
  source: AssessmentSourceGQL = AssessmentSourceGQL.MANUAL;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  summary?: string;

  @Field(() => GraphQLJSONObject)
  findings!: Record<string, unknown>;

  @Field(() => GraphQLJSONObject, { nullable: true })
  riskFlags?: Record<string, unknown>;

  @Field(() => GraphQLJSONObject, { nullable: true })
  recommendedActions?: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  assessorId?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  completedAt?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  reviewDueAt?: Date;
}
