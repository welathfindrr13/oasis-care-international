import { Global, Module } from "@nestjs/common";
import { DbModule } from "@oasis/db";
import { AccessContextResolver } from "./access-context.resolver";
import { AccessContextService } from "./access-context.service";
import { ApiRolesGuard } from "./api-roles.guard";
import { GqlJwtAuthGuard } from "./gql-jwt-auth.guard";
import { GqlRolesGuard } from "./gql-roles.guard";

@Global()
@Module({
  imports: [DbModule],
  providers: [
    AccessContextService,
    AccessContextResolver,
    ApiRolesGuard,
    GqlJwtAuthGuard,
    GqlRolesGuard,
  ],
  exports: [
    AccessContextService,
    ApiRolesGuard,
    GqlJwtAuthGuard,
    GqlRolesGuard,
  ],
})
export class AuthAccessModule {}
