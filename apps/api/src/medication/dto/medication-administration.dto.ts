import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { MedicationAdministration, MedicationStatus } from '@oasis/db';
import { PrescriptionDto } from './prescription.dto';

registerEnumType(MedicationStatus, {
  name: 'MedicationStatus',
});

@ObjectType()
export class VisitDto {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  carerId: string;

  @Field(() => ID)
  clientId: string;

  @Field()
  scheduledStart: Date;

  @Field()
  scheduledEnd: Date;
}

@ObjectType()
export class MedicationAdministrationDto {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  prescriptionId: string;

  @Field(() => ID, { nullable: true })
  visitId?: string;

  @Field()
  scheduledTime: Date;

  @Field({ nullable: true })
  administeredTime?: Date;

  @Field({ nullable: true })
  administeredBy?: string;

  @Field(() => MedicationStatus)
  status: MedicationStatus;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => PrescriptionDto, { nullable: true })
  prescription?: PrescriptionDto;

  @Field(() => VisitDto, { nullable: true })
  visit?: VisitDto;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  constructor(administration: MedicationAdministration & { prescription?: any; visit?: any }) {
    this.id = administration.id;
    this.prescriptionId = administration.prescription_id;
    this.visitId = administration.visit_id ?? undefined;
    this.scheduledTime = administration.scheduled_time;
    this.administeredTime = administration.administered_time ?? undefined;
    this.administeredBy = administration.administered_by ?? undefined;
    this.status = administration.status;
    this.notes = administration.notes ?? undefined;
    this.createdAt = administration.created_at;
    this.updatedAt = administration.updated_at;

    if (administration.prescription) {
      this.prescription = new PrescriptionDto(administration.prescription);
    }

    if (administration.visit) {
      this.visit = {
        id: administration.visit.id,
        carerId: administration.visit.carer_id,
        clientId: administration.visit.client_id,
        scheduledStart: administration.visit.scheduled_start,
        scheduledEnd: administration.visit.scheduled_end,
      };
    }
  }
}
