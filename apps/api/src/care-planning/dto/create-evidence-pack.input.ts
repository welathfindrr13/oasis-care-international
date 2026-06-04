import { Field, InputType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EvidencePackStatusGQL, EvidenceSourceTypeGQL } from './care-planning.dto';

@InputType()
export class CreateEvidenceItemInput {
  @Field(() => EvidenceSourceTypeGQL)
  @IsEnum(EvidenceSourceTypeGQL)
  sourceType!: EvidenceSourceTypeGQL;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  occurredAt?: Date;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  headline!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  detail?: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata?: Record<string, unknown>;
}

@InputType()
export class CreateEvidencePackInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  carePlanId?: string;

  @Field(() => EvidencePackStatusGQL, { defaultValue: EvidencePackStatusGQL.DRAFT })
  @IsEnum(EvidencePackStatusGQL)
  status: EvidencePackStatusGQL = EvidencePackStatusGQL.DRAFT;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  kind?: string;

  @Field(() => Date)
  periodStart!: Date;

  @Field(() => Date)
  periodEnd!: Date;

  @Field(() => GraphQLJSONObject, { nullable: true })
  summary?: Record<string, unknown>;

  @Field(() => GraphQLJSONObject, { nullable: true })
  sourceRefs?: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  generatedBy?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  publishedAt?: Date;

  @Field(() => [CreateEvidenceItemInput], { nullable: true })
  items?: CreateEvidenceItemInput[];
}
