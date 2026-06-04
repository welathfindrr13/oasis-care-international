import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, IsDateString, IsEnum, IsOptional, IsString, ValidateNested, IsArray, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { VisitStatus } from '@oasis/db';

@InputType()
export class CreateVisitTaskInput {
  @Field()
  @IsString()
  taskName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class CreateVisitInput {
  @Field(() => ID)
  // Cognito `sub` values may use UUID variants that strict UUID validators can reject.
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  carerId!: string;

  @Field(() => ID)
  @IsUUID()
  clientId!: string;

  @Field()
  @IsDateString()
  scheduledStart!: string;

  @Field()
  @IsDateString()
  scheduledEnd!: string;

  @Field(() => VisitStatus, { nullable: true })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => [CreateVisitTaskInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVisitTaskInput)
  tasks?: CreateVisitTaskInput[];
}
