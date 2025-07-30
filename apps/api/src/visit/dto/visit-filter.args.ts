import { ArgsType, Field, ID, Int } from '@nestjs/graphql';
import { IsOptional, IsUUID, IsEnum, IsDateString, IsInt, Min, Max } from 'class-validator';
import { VisitStatus } from '@oasis/db';

@ArgsType()
export class VisitFilterArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  carerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @Field(() => VisitStatus, { nullable: true })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  scheduledStartFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  scheduledStartTo?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
