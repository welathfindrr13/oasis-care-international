import { ArgsType, Field } from '@nestjs/graphql';
import { IsDateString, IsOptional } from 'class-validator';

@ArgsType()
export class ShiftAnalyticsFilterArgs {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  from?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  to?: string;
}
