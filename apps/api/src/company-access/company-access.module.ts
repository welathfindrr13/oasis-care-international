import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { DbModule } from "@oasis/db";
import { AuthAccessModule } from "../auth/auth-access.module";
import { InvitationLifecycleModule } from "../invitation-lifecycle/invitation-lifecycle.module";
import { createCompanyAccessRequestRateLimiter } from "../security/api-hardening";
import { ClerkProvisioningAdapter } from "./clerk-provisioning.adapter";
import { CompanyAccessController } from "./company-access.controller";
import { CompanyAccessResolver } from "./company-access.resolver";
import { CompanyAccessService } from "./company-access.service";
import { OrganizationProvisioningService } from "./organization-provisioning.service";
import { OrganizationSetupResolver } from "./organization-setup.resolver";
import { GqlPlatformOperatorGuard } from "./platform-operator.guard";

function requireCompanyAccessJson(req: any, res: any, next: () => void): void {
  if (
    !String(req.headers?.["content-type"] || "")
      .toLowerCase()
      .startsWith("application/json")
  ) {
    res.status(415).json({
      statusCode: 415,
      error: "Unsupported Media Type",
      message: "JSON requests are required",
    });
    return;
  }
  next();
}

@Module({
  imports: [DbModule, AuthAccessModule, InvitationLifecycleModule],
  controllers: [CompanyAccessController],
  providers: [
    ClerkProvisioningAdapter,
    CompanyAccessResolver,
    CompanyAccessService,
    GqlPlatformOperatorGuard,
    OrganizationProvisioningService,
    OrganizationSetupResolver,
  ],
})
export class CompanyAccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(requireCompanyAccessJson, createCompanyAccessRequestRateLimiter())
      .forRoutes({
        path: "company-access-requests",
        method: RequestMethod.POST,
      });
  }
}
