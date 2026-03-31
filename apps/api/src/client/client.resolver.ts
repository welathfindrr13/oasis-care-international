import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { RolesGuard } from '@oasis/auth';
import { ClientDTO, ClientPaginatedResponse } from './dto/client.dto';
import { CreateClientInput } from './dto/create-client.input';
import { UpdateClientInput } from './dto/update-client.input';
import { ClientService } from './client.service';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

@Resolver(() => ClientDTO)
@UseGuards(RolesGuard)
export class ClientResolver {
  constructor(private readonly clientService: ClientService) {}

  @Query(() => ClientPaginatedResponse)
  @Roles('admin')
  async clients(
    @Args('skip', { type: () => Int, nullable: true, defaultValue: 0 }) skip: number,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 20 }) take: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<ClientPaginatedResponse> {
    return this.clientService.findClients({ skip, take, search });
  }

  @Query(() => ClientDTO)
  @Roles('admin')
  async client(@Args('id') id: string): Promise<ClientDTO> {
    return this.clientService.findClientById(id);
  }

  @Mutation(() => ClientDTO)
  @Roles('admin')
  async createClient(
    @Args('input') input: CreateClientInput,
    @Context() ctx: any,
  ): Promise<ClientDTO> {
    // GDPR: Pass user ID for audit logging
    const userId = ctx.req?.user?.sub || ctx.req?.user?.id || 'anonymous';
    return this.clientService.createClient(input, userId);
  }

  @Mutation(() => ClientDTO)
  @Roles('admin')
  async updateClient(
    @Args('input') input: UpdateClientInput,
    @Context() ctx: any,
  ): Promise<ClientDTO> {
    const userId = ctx.req?.user?.sub || ctx.req?.user?.id || 'anonymous';
    return this.clientService.updateClient(input, userId);
  }
}
