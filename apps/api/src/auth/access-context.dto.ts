import { Field, ObjectType, registerEnumType } from "@nestjs/graphql";
import {
  AccessMembershipState,
  AccessOnboardingState,
  AccessSurface,
  CanonicalAccessContext,
  LinkedIdentityState,
} from "./access-context.service";

export enum ViewerMembershipState {
  ACTIVE = "ACTIVE",
  MISSING = "MISSING",
  INACTIVE = "INACTIVE",
  AMBIGUOUS = "AMBIGUOUS",
  ORGANIZATION_MISMATCH = "ORGANIZATION_MISMATCH",
}

export enum ViewerAccessSurface {
  ADMIN = "ADMIN",
  STAFF = "STAFF",
  FAMILY = "FAMILY",
  NONE = "NONE",
}

export enum ViewerLinkedIdentityState {
  LINKED = "LINKED",
  NOT_REQUIRED = "NOT_REQUIRED",
  REQUIRED = "REQUIRED",
  INVALID = "INVALID",
}

export enum ViewerOnboardingState {
  READY = "READY",
  NOT_STARTED = "NOT_STARTED",
  PENDING_INVITATION = "PENDING_INVITATION",
  SETUP_REQUIRED = "SETUP_REQUIRED",
  BLOCKED = "BLOCKED",
}

registerEnumType(ViewerMembershipState, { name: "ViewerMembershipState" });
registerEnumType(ViewerAccessSurface, { name: "ViewerAccessSurface" });
registerEnumType(ViewerLinkedIdentityState, {
  name: "ViewerLinkedIdentityState",
});
registerEnumType(ViewerOnboardingState, { name: "ViewerOnboardingState" });

@ObjectType()
export class ViewerAccessSnapshotDto {
  @Field(() => Boolean)
  authenticated!: boolean;

  @Field(() => String, { nullable: true })
  organizationId!: string | null;

  @Field(() => String, { nullable: true })
  effectiveRole!: string | null;

  @Field(() => ViewerMembershipState)
  membershipState!: AccessMembershipState;

  @Field(() => ViewerAccessSurface)
  surface!: AccessSurface;

  @Field(() => ViewerLinkedIdentityState)
  linkedIdentityState!: LinkedIdentityState;

  @Field(() => ViewerOnboardingState)
  onboardingState!: AccessOnboardingState;

  static from(context: CanonicalAccessContext): ViewerAccessSnapshotDto {
    return {
      authenticated: true,
      organizationId: context.organizationId,
      effectiveRole: context.effectiveRole,
      membershipState: context.membershipState,
      surface: context.surface,
      linkedIdentityState: context.linkedIdentityState,
      onboardingState: context.onboardingState,
    };
  }
}
