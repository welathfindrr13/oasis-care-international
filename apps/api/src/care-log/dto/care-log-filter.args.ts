import { ArgsType, Field, ID, Int } from '@nestjs/graphql';
import { CareLogCategory } from '@oasis/db';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

@ArgsType()
export class CareLogFilterArgs {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  carerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  visitId?: string;

  @Field(() => CareLogCategory, { nullable: true })
  @IsOptional()
  @IsEnum(CareLogCategory)
  category?: CareLogCategory;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  occurredFrom?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  occurredTo?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  take?: number;
}
