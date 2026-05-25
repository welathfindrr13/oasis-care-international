import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class CompleteAssessmentInput {
  @Field(() => String)
  @IsString()
  assessmentId!: string;

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
