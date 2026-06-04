import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { CarerDTO } from './dto/carer.dto';
import { CarerService } from './carer.service';
import { UpsertCarerInput } from './dto/upsert-carer.input';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

@Resolver(() => CarerDTO)
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class CarerResolver {
  constructor(private readonly carerService: CarerService) {}

  @Query(() => [CarerDTO])
  @Roles('admin')
  async carers(@Context() ctx: any): Promise<CarerDTO[]> {
    const organizationId = ctx?.req?.user?.organizationId;
    return this.carerService.findCarers(organizationId);
  }

  @Mutation(() => CarerDTO)
  @Roles('admin')
  async upsertCarer(@Args('input') input: UpsertCarerInput, @Context() ctx: any): Promise<CarerDTO> {
    const organizationId = ctx?.req?.user?.organizationId;
    return this.carerService.upsertCarer(input, organizationId);
  }
}
