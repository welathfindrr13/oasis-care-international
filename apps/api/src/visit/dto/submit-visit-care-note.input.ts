import { Field, ID, InputType } from '@nestjs/graphql';
import { CareLogCategory } from '@oasis/db';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

@InputType()
export class SubmitVisitCareNoteInput {
  @Field(() => ID)
  @IsUUID()
  visitId!: string;

  @Field(() => String)
  @IsString()
  notes!: string;

  @Field(() => CareLogCategory)
  @IsEnum(CareLogCategory)
  category!: CareLogCategory;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  escalated?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  escalatedTo?: string;
}
