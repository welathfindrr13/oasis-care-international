import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { VisitTaskOutcome } from './visit.dto';

@InputType()
export class RecordVisitTaskOutcomeInput {
  @Field(() => ID)
  @IsUUID()
  taskId!: string;

  @Field(() => VisitTaskOutcome)
  @IsEnum(VisitTaskOutcome)
  outcome!: VisitTaskOutcome;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
