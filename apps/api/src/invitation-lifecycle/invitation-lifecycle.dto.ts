import { Field, InputType, ObjectType } from "@nestjs/graphql";
import { IsUUID } from "class-validator";

@InputType()
export class InvitationActivationInputDTO {
  @Field()
  @IsUUID()
  invitationId!: string;
}

@ObjectType()
export class InvitationActivationResultDTO {
  @Field()
  status!: "ACTIVE";

  @Field()
  externalOrganizationId!: string;
}
