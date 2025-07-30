import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { VisitStatus } from '@oasis/db';

// Register enum for GraphQL
registerEnumType(VisitStatus, {
  name: 'VisitStatus',
  description: 'The status of a visit',
});

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
export class VisitTaskDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  taskName!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field()
  isCompleted!: boolean;

  @Field(() => Date, { nullable: true })
  completedAt?: Date | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class VisitDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  carerId!: string;

  @Field()
  clientId!: string;

  @Field()
  scheduledStart!: Date;

  @Field()
  scheduledEnd!: Date;

  @Field(() => Date, { nullable: true })
  actualStart?: Date;

  @Field(() => Date, { nullable: true })
  actualEnd?: Date;

  @Field(() => VisitStatus)
  status!: VisitStatus;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => CarerDTO, { nullable: true })
  carer?: CarerDTO | null;

  @Field(() => ClientDTO, { nullable: true })
  client?: ClientDTO | null;

  @Field(() => [VisitTaskDTO])
  tasks!: VisitTaskDTO[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class VisitPaginatedResponse {
  @Field(() => [VisitDTO])
  items!: VisitDTO[];

  @Field()
  total!: number;
}
