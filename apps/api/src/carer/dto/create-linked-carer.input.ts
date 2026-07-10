import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

@InputType()
export class CreateLinkedCarerInput {
  @Field(() => ID)
  @IsUUID()
  membershipId!: string;

  @Field()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  firstName!: string;

  @Field()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  lastName!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
