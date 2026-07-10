import { UseGuards } from "@nestjs/common";
import { Args, Context, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import { GqlJwtAuthGuard } from "../auth/gql-jwt-auth.guard";
import { ManualAudit } from "../common/decorators/manual-audit.decorator";
import {
  PlatformCompanyAccessRejectionCode,
  PlatformCompanyAccessRequestDTO,
  PlatformCompanyAccessRequestPageDTO,
  PlatformCompanyAccessRequestStatus,
} from "./company-access.dto";
import { CompanyAccessService } from "./company-access.service";
import { GqlPlatformOperatorGuard } from "./platform-operator.guard";

@Resolver(() => PlatformCompanyAccessRequestDTO)
@UseGuards(GqlJwtAuthGuard, GqlPlatformOperatorGuard)
export class CompanyAccessResolver {
  constructor(private readonly companyAccess: CompanyAccessService) {}

  @Query(() => PlatformCompanyAccessRequestPageDTO)
  companyAccessRequests(
    @Args("status", {
      type: () => PlatformCompanyAccessRequestStatus,
      defaultValue: PlatformCompanyAccessRequestStatus.PENDING_APPROVAL,
    })
    status: PlatformCompanyAccessRequestStatus,
    @Args("offset", { type: () => Int, defaultValue: 0 }) offset: number,
    @Args("limit", { type: () => Int, defaultValue: 50 }) limit: number,
  ): Promise<PlatformCompanyAccessRequestPageDTO> {
    return this.companyAccess.list(status, offset, limit);
  }

  @Query(() => PlatformCompanyAccessRequestDTO)
  companyAccessRequest(
    @Args("id") id: string,
  ): Promise<PlatformCompanyAccessRequestDTO> {
    return this.companyAccess.get(id);
  }

  @Mutation(() => PlatformCompanyAccessRequestDTO)
  @ManualAudit()
  approveCompanyAccessRequest(
    @Args("id") id: string,
    @Context() context: any,
  ): Promise<PlatformCompanyAccessRequestDTO> {
    return this.companyAccess.approve(id, this.operatorSubject(context));
  }

  @Mutation(() => PlatformCompanyAccessRequestDTO)
  @ManualAudit()
  rejectCompanyAccessRequest(
    @Args("id") id: string,
    @Args("rejectionCode", { type: () => PlatformCompanyAccessRejectionCode })
    rejectionCode: PlatformCompanyAccessRejectionCode,
    @Context() context: any,
  ): Promise<PlatformCompanyAccessRequestDTO> {
    return this.companyAccess.reject(
      id,
      this.operatorSubject(context),
      rejectionCode,
    );
  }

  @Mutation(() => PlatformCompanyAccessRequestDTO)
  @ManualAudit()
  retryCompanyProvisioning(
    @Args("id") id: string,
    @Context() context: any,
  ): Promise<PlatformCompanyAccessRequestDTO> {
    return this.companyAccess.retryProvisioning(
      id,
      this.operatorSubject(context),
    );
  }

  private operatorSubject(context: any): string {
    return String(context?.req?.user?.sub || context?.req?.user?.id || "");
  }
}
