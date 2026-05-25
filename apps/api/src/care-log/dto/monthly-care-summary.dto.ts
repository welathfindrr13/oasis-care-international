import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { CareLogCategory } from '@oasis/db';

@ObjectType()
export class MonthlyCareCategoryCountDTO {
  @Field(() => CareLogCategory)
  category!: CareLogCategory;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class MonthlyMedicationSummaryDTO {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  scheduled!: number;

  @Field(() => Int)
  administered!: number;

  @Field(() => Int)
  missed!: number;

  @Field(() => Int)
  refused!: number;

  @Field(() => Int)
  cancelled!: number;
}

@ObjectType()
export class MonthlyCareSummaryDTO {
  @Field(() => GraphQLISODateTime)
  monthStart!: Date;

  @Field(() => GraphQLISODateTime)
  monthEnd!: Date;

  @Field(() => Int)
  totalCareLogs!: number;

  @Field(() => [MonthlyCareCategoryCountDTO])
  byCategory!: MonthlyCareCategoryCountDTO[];

  @Field(() => MonthlyMedicationSummaryDTO)
  medication!: MonthlyMedicationSummaryDTO;

  @Field(() => [String])
  highlights!: string[];
}
