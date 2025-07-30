import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { VisitStatus } from '@oasis/db';

@InputType()
export class UpdateVisitInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @Field(() => VisitStatus, { nullable: true })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
