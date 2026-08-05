import { InputType, Field, ID } from "@nestjs/graphql";
import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
  ArrayMaxSize,
  IsNotEmpty,
  MaxLength,
  Matches,
} from "class-validator";
import { Transform, Type } from "class-transformer";

@InputType()
export class CreateVisitTaskInput {
  @Field()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(120)
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

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => [CreateVisitTaskInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateVisitTaskInput)
  tasks?: CreateVisitTaskInput[];
}
