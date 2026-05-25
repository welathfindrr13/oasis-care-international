import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { ClientDTO, ClientPaginatedResponse } from './dto/client.dto';
import { CreateClientInput } from './dto/create-client.input';
import { UpdateClientInput } from './dto/update-client.input';
import { ClientService } from './client.service';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

@Resolver(() => ClientDTO)
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class ClientResolver {
  constructor(private readonly clientService: ClientService) {}

  @Query(() => ClientPaginatedResponse)
  @Roles('admin', 'carer')
  async clients(
    @Args('skip', { type: () => Int, nullable: true, defaultValue: 0 }) skip: number,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 20 }) take: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Context() ctx?: any,
  ): Promise<ClientPaginatedResponse> {
    const userId = ctx?.req?.user?.sub || ctx?.req?.user?.id || '';
    const userRole = ctx?.req?.user?.realm_access?.roles?.[0] || 'carer';
    const organizationId = ctx?.req?.user?.organizationId;
    return this.clientService.findClients({ skip, take, search }, userId, userRole, organizationId);
  }

  @Query(() => ClientDTO)
  @Roles('admin', 'carer')
  async client(@Args('id') id: string, @Context() ctx: any): Promise<ClientDTO> {
    const userId = ctx?.req?.user?.sub || ctx?.req?.user?.id || '';
    const userRole = ctx?.req?.user?.realm_access?.roles?.[0] || 'carer';
    const organizationId = ctx?.req?.user?.organizationId;
    return this.clientService.findClientById(id, userId, userRole, organizationId);
  }

  @Mutation(() => ClientDTO)
  @Roles('admin')
  async createClient(
    @Args('input') input: CreateClientInput,
    @Context() ctx: any,
  ): Promise<ClientDTO> {
    // GDPR: Pass user ID for audit logging
    const userId = ctx.req?.user?.sub || ctx.req?.user?.id || 'anonymous';
    const organizationId = ctx.req?.user?.organizationId;
    return this.clientService.createClient(input, userId, organizationId);
  }

  @Mutation(() => ClientDTO)
  @Roles('admin')
  async updateClient(
    @Args('id') id: string,
    @Args('input') input: UpdateClientInput,
    @Context() ctx: any,
  ): Promise<ClientDTO> {
    const userId = ctx.req?.user?.sub || ctx.req?.user?.id || 'anonymous';
    const organizationId = ctx.req?.user?.organizationId;
    return this.clientService.updateClient(id, input, userId, organizationId);
  }

  @Mutation(() => ClientDTO)
  @Roles('admin')
  async deleteClient(
    @Args('id') id: string,
    @Context() ctx: any,
  ): Promise<ClientDTO> {
    const userId = ctx.req?.user?.sub || ctx.req?.user?.id || 'anonymous';
    const organizationId = ctx.req?.user?.organizationId;
    return this.clientService.deleteClient(id, userId, organizationId);
  }
}
