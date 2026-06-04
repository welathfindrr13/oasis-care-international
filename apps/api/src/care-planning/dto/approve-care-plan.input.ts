import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class ApproveCarePlanInput {
  @Field(() => String)
  @IsString()
  carePlanId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  approvedById?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  approvedAt?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  effectiveFrom?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  reviewDueAt?: Date;
}
