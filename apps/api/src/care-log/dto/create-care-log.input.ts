import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { CareLogCategory, IntakeAmount, MoodLevel, StoolType } from '@oasis/db';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

@InputType()
export class CreateCareLogInput {
  @Field(() => ID)
  @IsUUID()
  clientId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  carerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  visitId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  medicationAdministrationId?: string;

  @Field(() => String)
  @IsDateString()
  occurredAt!: string;

  @Field(() => CareLogCategory)
  @IsEnum(CareLogCategory)
  category!: CareLogCategory;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  urinePassed?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  bowelMovement?: boolean;

  @Field(() => StoolType, { nullable: true })
  @IsOptional()
  @IsEnum(StoolType)
  stoolType?: StoolType;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  continenceStatus?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  assistanceLevel?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  mealType?: string;

  @Field(() => IntakeAmount, { nullable: true })
  @IsOptional()
  @IsEnum(IntakeAmount)
  intakeAmount?: IntakeAmount;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  fluidMl?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  appetite?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  slept?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  sleepStart?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  sleepEnd?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  sleepQuality?: string;

  @Field(() => MoodLevel, { nullable: true })
  @IsOptional()
  @IsEnum(MoodLevel)
  moodLevel?: MoodLevel;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  agitation?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  confusion?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painScore?: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  escalated?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  escalatedTo?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  escalatedAt?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  source?: string;
}
