import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, IsDateString, IsOptional } from 'class-validator';

@InputType()
export class GenerateSummaryInput {
  @Field(() => ID)
  @IsUUID()
  clientId!: string;

  @Field()
  @IsDateString()
  periodStart!: string;

  @Field()
  @IsDateString()
  periodEnd!: string;
}
