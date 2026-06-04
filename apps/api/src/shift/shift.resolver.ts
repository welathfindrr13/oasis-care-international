import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { ShiftService } from './shift.service';
import { CarerShiftDto, ShiftAnalyticsDto } from './dto/carer-shift.dto';
import { ClockInInput } from './dto/clock-in.input';
import { ClockOutInput } from './dto/clock-out.input';
import { ShiftAnalyticsFilterArgs } from './dto/shift-analytics-filter.args';
import { Context } from '@nestjs/graphql';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

@Resolver()
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class ShiftResolver {
  constructor(private readonly shiftService: ShiftService) {}

  @Query(() => CarerShiftDto, { nullable: true })
  @Roles('admin', 'carer')
  async myActiveShift(@Context() ctx: any): Promise<CarerShiftDto | null> {
    const { sub: userId, realm_access, organizationId } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'user';
    return this.shiftService.myActiveShift(userId, userRole, organizationId);
  }

  @Query(() => [CarerShiftDto])
  @Roles('admin', 'carer')
  async myRecentShifts(
    @Args('take', { type: () => Int, nullable: true, defaultValue: 5 }) take: number,
    @Context() ctx: any,
  ): Promise<CarerShiftDto[]> {
    const { sub: userId, realm_access, organizationId } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'user';
    return this.shiftService.myRecentShifts(userId, userRole, organizationId, take);
  }

  @Mutation(() => CarerShiftDto)
  @Roles('carer')
  async clockIn(
    @Args('input', { type: () => ClockInInput, nullable: true }) input: ClockInInput = new ClockInInput(),
    @Context() ctx: any,
  ): Promise<CarerShiftDto> {
    const { sub: userId, realm_access, organizationId } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'user';
    return this.shiftService.clockIn(input, userId, userRole, organizationId);
  }

  @Mutation(() => CarerShiftDto)
  @Roles('carer')
  async clockOut(
    @Args('input', { type: () => ClockOutInput, nullable: true }) input: ClockOutInput = new ClockOutInput(),
    @Context() ctx: any,
  ): Promise<CarerShiftDto> {
    const { sub: userId, realm_access, organizationId } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'user';
    return this.shiftService.clockOut(input, userId, userRole, organizationId);
  }

  @Query(() => ShiftAnalyticsDto)
  @Roles('admin')
  async shiftAnalytics(
    @Args() args: ShiftAnalyticsFilterArgs,
    @Context() ctx: any,
  ): Promise<ShiftAnalyticsDto> {
    const { organizationId } = ctx.req.user;
    return this.shiftService.analytics(args.from, args.to, organizationId);
  }
}
