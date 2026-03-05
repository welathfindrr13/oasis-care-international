import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

@InputType()
export class CreateClientInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressLine1!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postcode!: string;
}

