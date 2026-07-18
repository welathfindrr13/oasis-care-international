import { Transform } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Field, Int, ObjectType, registerEnumType } from "@nestjs/graphql";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const trimOptional = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class CreateCompanyAccessRequestInput {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contactName!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  businessEmail!: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  operationalNote?: string;
}

export enum PlatformCompanyAccessRequestStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  DISABLED = "DISABLED",
}

export enum PlatformProvisioningStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  RETRYABLE = "RETRYABLE",
  DELIVERED = "DELIVERED",
  NEEDS_ATTENTION = "NEEDS_ATTENTION",
}

export enum PlatformBootstrapManagerAccessStatus {
  ACTIVE = "ACTIVE",
  REVOKED = "REVOKED",
  UNAVAILABLE = "UNAVAILABLE",
}

export enum PlatformBootstrapManagerCleanupStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING = "PENDING",
  COMPLETE = "COMPLETE",
  NEEDS_ATTENTION = "NEEDS_ATTENTION",
}

export enum PlatformCompanyAccessRejectionCode {
  NOT_ELIGIBLE = "NOT_ELIGIBLE",
  DUPLICATE = "DUPLICATE",
  UNVERIFIED_BUSINESS = "UNVERIFIED_BUSINESS",
  OTHER = "OTHER",
}

registerEnumType(PlatformCompanyAccessRequestStatus, {
  name: "PlatformCompanyAccessRequestStatus",
});
registerEnumType(PlatformProvisioningStatus, {
  name: "PlatformProvisioningStatus",
});
registerEnumType(PlatformBootstrapManagerAccessStatus, {
  name: "PlatformBootstrapManagerAccessStatus",
});
registerEnumType(PlatformBootstrapManagerCleanupStatus, {
  name: "PlatformBootstrapManagerCleanupStatus",
});
registerEnumType(PlatformCompanyAccessRejectionCode, {
  name: "PlatformCompanyAccessRejectionCode",
});

@ObjectType()
export class PlatformCompanyAccessRequestDTO {
  @Field()
  id!: string;

  @Field()
  companyName!: string;

  @Field()
  contactName!: string;

  @Field()
  businessEmail!: string;

  @Field({ nullable: true })
  operationalNote?: string;

  @Field(() => PlatformCompanyAccessRequestStatus)
  status!: PlatformCompanyAccessRequestStatus;

  @Field({ nullable: true })
  organizationId?: string;

  @Field(() => PlatformProvisioningStatus, { nullable: true })
  provisioningStatus?: PlatformProvisioningStatus;

  @Field(() => Int, { nullable: true })
  provisioningAttemptCount?: number;

  @Field({ nullable: true })
  provisioningErrorCode?: string;

  @Field({ nullable: true })
  bootstrapManagerEmail?: string;

  @Field(() => PlatformBootstrapManagerAccessStatus)
  bootstrapManagerAccessStatus!: PlatformBootstrapManagerAccessStatus;

  @Field(() => PlatformBootstrapManagerCleanupStatus)
  bootstrapManagerCleanupStatus!: PlatformBootstrapManagerCleanupStatus;

  @Field({ nullable: true })
  bootstrapManagerCleanupErrorCode?: string;

  @Field(() => Date)
  requestedAt!: Date;

  @Field(() => Date, { nullable: true })
  reviewedAt?: Date;
}

@ObjectType()
export class PlatformCompanyAccessRequestPageDTO {
  @Field(() => [PlatformCompanyAccessRequestDTO])
  items!: PlatformCompanyAccessRequestDTO[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  offset!: number;

  @Field(() => Int)
  limit!: number;
}

@ObjectType()
export class OrganizationSetupDetailsDTO {
  @Field()
  id!: string;

  @Field()
  name!: string;
}
