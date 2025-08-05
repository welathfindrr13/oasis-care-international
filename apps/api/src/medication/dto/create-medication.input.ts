import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

@InputType()
export class CreateMedicationInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dosage: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  instructions?: string;
}
