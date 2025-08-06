import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, IsOptional, IsString, IsIn } from 'class-validator';

@InputType()
export class ApproveSummaryInput {
  @Field(() => ID)
  @IsUUID()
  summaryId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['approved', 'rejected'])
  feedback?: string;
}
