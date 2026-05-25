import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EvidenceSourceTypeGQL } from './care-planning.dto';

@InputType()
export class EvidenceSourceCandidatesInput {
  @Field(() => String)
  @IsString()
  clientId!: string;

  @Field(() => Date)
  periodStart!: Date;

  @Field(() => Date)
  periodEnd!: Date;

  @Field(() => [EvidenceSourceTypeGQL], { nullable: true })
  @IsOptional()
  @IsEnum(EvidenceSourceTypeGQL, { each: true })
  sourceTypes?: EvidenceSourceTypeGQL[];

  @Field(() => Int, { nullable: true, defaultValue: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 100;
}
