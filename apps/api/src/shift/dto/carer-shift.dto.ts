import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ShiftVerificationMethod } from '@oasis/db';

registerEnumType(ShiftVerificationMethod, {
  name: 'ShiftVerificationMethod',
  description: 'How a clock event was verified',
});

@ObjectType()
export class ShiftLocationProofDto {
  @Field(() => Number, { nullable: true })
  latitude?: number | null;

  @Field(() => Number, { nullable: true })
  longitude?: number | null;

  @Field(() => Number, { nullable: true })
  accuracyMeters?: number | null;

  @Field(() => ShiftVerificationMethod)
  method!: ShiftVerificationMethod;

  @Field(() => String, { nullable: true })
  source?: string | null;

  @Field(() => String, { nullable: true })
  reasonCode?: string | null;
}

@ObjectType()
export class CarerShiftDto {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  carerId!: string;

  @Field(() => Date)
  clockInAt!: Date;

  @Field(() => Date, { nullable: true })
  clockOutAt?: Date | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => ShiftLocationProofDto)
  clockInProof!: ShiftLocationProofDto;

  @Field(() => ShiftLocationProofDto, { nullable: true })
  clockOutProof?: ShiftLocationProofDto | null;

  @Field(() => Date, { nullable: true })
  locationConsentAt?: Date | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
export class ShiftMethodBreakdownDto {
  @Field(() => Number)
  gps!: number;

  @Field(() => Number)
  qr!: number;

  @Field(() => Number)
  nfc!: number;

  @Field(() => Number)
  phone!: number;

  @Field(() => Number)
  manual!: number;
}

@ObjectType()
export class ShiftAnalyticsDto {
  @Field(() => Number)
  activeCarersNow!: number;

  @Field(() => Number)
  openShiftCount!: number;

  @Field(() => Number)
  clockIns!: number;

  @Field(() => Number)
  clockOuts!: number;

  @Field(() => Number)
  averageShiftMinutes!: number;

  @Field(() => ShiftMethodBreakdownDto)
  clockInMethods!: ShiftMethodBreakdownDto;

  @Field(() => ShiftMethodBreakdownDto)
  clockOutMethods!: ShiftMethodBreakdownDto;
}
