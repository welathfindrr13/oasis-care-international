import { Field, ID, InputType } from '@nestjs/graphql';
import { AccessGrantScope, CareRoomRole, FamilyAccessBasis } from '../../dto/carebridge.enums';

@InputType()
export class GrantCareRoomAccessInput {
  @Field(() => ID)
  careRoomId!: string;

  @Field()
  fullName!: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  authSubject?: string;

  @Field(() => String, { nullable: true })
  relationship?: string;

  @Field(() => CareRoomRole)
  role!: CareRoomRole;

  @Field(() => FamilyAccessBasis)
  accessBasis!: FamilyAccessBasis;

  @Field(() => [AccessGrantScope])
  scopes!: AccessGrantScope[];

  @Field(() => Date, { nullable: true })
  reviewDueAt?: Date;
}
