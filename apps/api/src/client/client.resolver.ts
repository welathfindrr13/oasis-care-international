import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { ClientDTO, ClientPaginatedResponse } from './dto/client.dto';
import { CreateClientInput } from './dto/create-client.input';
import { ClientService } from './client.service';

@Resolver(() => ClientDTO)
export class ClientResolver {
  constructor(private readonly clientService: ClientService) {}

  @Query(() => ClientPaginatedResponse)
  async clients(
    @Args('skip', { type: () => Int, nullable: true, defaultValue: 0 }) skip: number,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 20 }) take: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<ClientPaginatedResponse> {
    return this.clientService.findClients({ skip, take, search });
  }

  @Query(() => ClientDTO)
  async client(@Args('id') id: string): Promise<ClientDTO> {
    return this.clientService.findClientById(id);
  }

  @Mutation(() => ClientDTO)
  async createClient(
    @Args('input') input: CreateClientInput,
    @Context() ctx: any,
  ): Promise<ClientDTO> {
    // GDPR: Pass user ID for audit logging
    const userId = ctx.req?.user?.sub || ctx.req?.user?.id || 'anonymous';
    return this.clientService.createClient(input, userId);
  }
}
