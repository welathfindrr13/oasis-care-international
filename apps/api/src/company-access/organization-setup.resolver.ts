import { SetMetadata, UseGuards } from "@nestjs/common";
import { Context, Query, Resolver } from "@nestjs/graphql";
import { GqlRolesGuard } from "../auth/gql-roles.guard";
import { LegacyOperationalSurface } from "../auth/legacy-operational-access";
import { requireOperationalActor } from "../carer/carer-access.service";
import { CompanyAccessService } from "./company-access.service";
import { OrganizationSetupDetailsDTO } from "./company-access.dto";

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata("roles", roles);

@Resolver(() => OrganizationSetupDetailsDTO)
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class OrganizationSetupResolver {
  constructor(private readonly companyAccess: CompanyAccessService) {}

  @Query(() => OrganizationSetupDetailsDTO)
  @Roles("admin")
  viewerOrganizationSetupDetails(
    @Context() context: any,
  ): Promise<OrganizationSetupDetailsDTO> {
    const { organizationId } = requireOperationalActor(context?.req?.user);
    return this.companyAccess.getOrganizationSetupDetails(organizationId);
  }
}
