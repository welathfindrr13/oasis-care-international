import { Field, InputType, Int } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CarePlanStatusGQL } from './care-planning.dto';

@InputType()
export class CreateCarePlanInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @Field(() => CarePlanStatusGQL, { defaultValue: CarePlanStatusGQL.DRAFT })
  @IsEnum(CarePlanStatusGQL)
  status: CarePlanStatusGQL = CarePlanStatusGQL.DRAFT;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number = 1;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @Field(() => GraphQLJSONObject)
  goals!: Record<string, unknown>;

  @Field(() => GraphQLJSONObject)
  interventions!: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  safetyNotes?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  effectiveFrom?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  effectiveTo?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  reviewDueAt?: Date;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  authoredById?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  approvedById?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  approvedAt?: Date;
}
