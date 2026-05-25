import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class ArchiveCarePlanInput {
  @Field(() => String)
  @IsString()
  carePlanId!: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  effectiveTo?: Date;
}
