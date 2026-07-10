import { Field, ID, ObjectType } from '@nestjs/graphql';
import { CarerDTO } from './carer.dto';

@ObjectType()
export class EligibleCarerMembershipDTO {
  @Field(() => ID)
  id!: string;

  @Field()
  identityProvider!: string;

  @Field()
  role!: string;

  @Field(() => String, { nullable: true })
  loginEmail?: string | null;
}

@ObjectType()
export class LinkedCarerDTO {
  @Field(() => CarerDTO)
  carer!: CarerDTO;

  @Field(() => ID)
  membershipId!: string;
}
