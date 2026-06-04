import { Field, InputType, ID } from '@nestjs/graphql';

@InputType()
export class CreateCareRoomInput {
  @Field(() => ID)
  clientId!: string;
}
