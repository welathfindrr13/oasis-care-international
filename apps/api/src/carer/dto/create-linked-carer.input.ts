import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

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

  @Field()
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
