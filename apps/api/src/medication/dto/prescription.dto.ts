import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Prescription } from '@oasis/db';
import { MedicationDto } from './medication.dto';

@ObjectType()
export class ClientDto {
  @Field(() => ID)
  id: string;

  @Field()
  fullName: string;

  @Field()
  addressLine1: string;

  @Field({ nullable: true })
  addressLine2?: string;

  @Field()
  city: string;

  @Field()
  postcode: string;
}

@ObjectType()
export class PrescriptionDto {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  clientId: string;

  @Field(() => ID)
  medicationId: string;

  @Field()
  startDate: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => Int)
  frequencyPerDay: number;

  @Field(() => Int, { nullable: true })
  frequencyIntervalHours?: number;

  @Field(() => [String])
  administrationTimes: string[];

  @Field({ nullable: true })
  specialInstructions?: string;

  @Field()
  isActive: boolean;

  @Field(() => ClientDto, { nullable: true })
  client?: ClientDto;

  @Field(() => MedicationDto, { nullable: true })
  medication?: MedicationDto;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  constructor(prescription: Prescription & { client?: any; medication?: any }) {
    this.id = prescription.id;
    this.clientId = prescription.client_id;
    this.medicationId = prescription.medication_id;
    this.startDate = prescription.start_date;
    this.endDate = prescription.end_date ?? undefined;
    this.frequencyPerDay = prescription.frequency_per_day;
    this.frequencyIntervalHours = prescription.frequency_interval_hours ?? undefined;
    this.administrationTimes = prescription.administration_times;
    this.specialInstructions = prescription.special_instructions ?? undefined;
    this.isActive = prescription.is_active;
    this.createdAt = prescription.created_at;
    this.updatedAt = prescription.updated_at;

    if (prescription.client) {
      this.client = {
        id: prescription.client.id,
        fullName: prescription.client.full_name,
        addressLine1: prescription.client.address_line1,
        addressLine2: prescription.client.address_line2 ?? undefined,
        city: prescription.client.city,
        postcode: prescription.client.postcode,
      };
    }

    if (prescription.medication) {
      this.medication = new MedicationDto(prescription.medication);
    }
  }
}
