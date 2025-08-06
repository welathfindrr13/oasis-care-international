import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

// Register enum for summary status
export enum SummaryStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

registerEnumType(SummaryStatus, {
  name: 'SummaryStatus',
  description: 'The approval status of a health summary',
});

@ObjectType()
export class HealthSummaryDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  clientId!: string;

  @Field()
  periodStart!: Date;

  @Field()
  periodEnd!: Date;

  @Field(() => GraphQLJSONObject)
  summaryJson!: any;

  @Field(() => GraphQLJSONObject)
  riskLevels!: any;

  @Field()
  generatedAt!: Date;

  @Field()
  generatedBy!: string;

  @Field(() => String, { nullable: true })
  approvedBy?: string | null;

  @Field(() => Date, { nullable: true })
  approvedAt?: Date | null;

  @Field(() => String, { nullable: true })
  feedback?: string | null;

  @Field()
  expiresAt!: Date;

  @Field(() => ClientDTO, { nullable: true })
  client?: ClientDTO | null;

  @Field(() => CarerDTO, { nullable: true })
  approver?: CarerDTO | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  // Computed field for status
  @Field(() => SummaryStatus)
  get status(): SummaryStatus {
    if (this.approvedBy && this.approvedAt) {
      return this.feedback === 'rejected' ? SummaryStatus.REJECTED : SummaryStatus.APPROVED;
    }
    return SummaryStatus.PENDING;
  }
}

@ObjectType()
export class CarerDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  phone?: string | null;
}

@ObjectType()
export class ClientDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  fullName!: string;

  @Field()
  addressLine1!: string;

  @Field(() => String, { nullable: true })
  addressLine2?: string | null;

  @Field()
  city!: string;

  @Field()
  postcode!: string;
}

@ObjectType()
export class HealthSummaryPaginatedResponse {
  @Field(() => [HealthSummaryDTO])
  items!: HealthSummaryDTO[];

  @Field()
  total!: number;
}
