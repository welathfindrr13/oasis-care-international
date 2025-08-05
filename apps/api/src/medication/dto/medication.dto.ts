import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Medication } from '@oasis/db';

@ObjectType()
export class MedicationDto {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  dosage: string;

  @Field()
  unit: string;

  @Field({ nullable: true })
  instructions?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  constructor(medication: Medication) {
    this.id = medication.id;
    this.name = medication.name;
    this.dosage = medication.dosage;
    this.unit = medication.unit;
    this.instructions = medication.instructions ?? undefined;
    this.createdAt = medication.created_at;
    this.updatedAt = medication.updated_at;
  }
}

@ObjectType()
export class MedicationListDto {
  @Field(() => [MedicationDto])
  items: MedicationDto[];

  @Field()
  total: number;

  constructor(medications: Medication[], total: number) {
    this.items = medications.map(med => new MedicationDto(med));
    this.total = total;
  }
}
