import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

@InputType()
export class CompleteVisitInput {
  @Field(() => ID)
  @IsUUID()
  visitId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  actualEnd?: string;
}
