import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, IsDateString, IsOptional } from 'class-validator';

@InputType()
export class UpdateVisitInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;
}
