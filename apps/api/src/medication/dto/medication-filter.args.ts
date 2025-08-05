import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

@ArgsType()
export class MedicationFilterArgs {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  @Min(0)
  skip?: number;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  take?: number;
}
