import { ArgsType, Field, ID, Int } from '@nestjs/graphql';
import { IsOptional, IsUUID, IsEnum, IsDateString, IsInt, Min, Max } from 'class-validator';
import { SummaryStatus } from './health-summary.dto';

@ArgsType()
export class HealthSummaryFilterArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @Field(() => SummaryStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SummaryStatus)
  status?: SummaryStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  periodStartFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  periodStartTo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  periodEndFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  periodEndTo?: string;

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
