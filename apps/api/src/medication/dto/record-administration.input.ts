import { InputType, Field, registerEnumType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { MedicationStatus } from '@oasis/db';

registerEnumType(MedicationStatus, {
  name: 'MedicationStatus',
});

@InputType()
export class RecordAdministrationInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  administrationId: string;

  @Field(() => MedicationStatus)
  @IsEnum(MedicationStatus)
  status: MedicationStatus;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  notes?: string;
}
