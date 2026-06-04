import { ObjectType, Field, ID } from '@nestjs/graphql';

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
