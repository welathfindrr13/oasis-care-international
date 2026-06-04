import { InputType, Field, ID } from '@nestjs/graphql';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

@InputType()
export class UpsertCarerInput {
  // IMPORTANT: We set carer.id = Cognito user sub so Visit RBAC can match `visit.carer_id === sub`.
  @Field(() => ID)
  // Cognito `sub` may be UUID variants not accepted by older class-validator UUID checks.
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  id!: string;

  @Field()
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @Field()
  @IsString()
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

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
