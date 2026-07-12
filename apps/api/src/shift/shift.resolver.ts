import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { ShiftService } from './shift.service';
import { CarerShiftDto, ShiftAnalyticsDto } from './dto/carer-shift.dto';
import { ClockInInput } from './dto/clock-in.input';
import { ClockOutInput } from './dto/clock-out.input';
import { ShiftAnalyticsFilterArgs } from './dto/shift-analytics-filter.args';
import { Context } from '@nestjs/graphql';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';
import { requireOperationalActor } from '../carer/carer-access.service';
import { RequireCapabilities } from '../auth/access-capability';

@Resolver()
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class ShiftResolver {
  constructor(private readonly shiftService: ShiftService) {}

  @Query(() => CarerShiftDto, { nullable: true })
  @RequireCapabilities('FRONTLINE_SHIFT_VIEW')
  async myActiveShift(@Context() ctx: any): Promise<CarerShiftDto | null> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);
    return this.shiftService.myActiveShift(userId, userRole, organizationId, accessContext);
  }

  @Query(() => [CarerShiftDto])
  @RequireCapabilities('FRONTLINE_SHIFT_VIEW')
  async myRecentShifts(
    @Args('take', { type: () => Int, nullable: true, defaultValue: 5 })
    take: number,
    @Context() ctx: any,
  ): Promise<CarerShiftDto[]> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);
    return this.shiftService.myRecentShifts(userId, userRole, organizationId, take, accessContext);
  }

  @Mutation(() => CarerShiftDto)
  @RequireCapabilities('FRONTLINE_SHIFT_EXECUTE')
  async clockIn(
    @Args('input', { type: () => ClockInInput, nullable: true })
    input: ClockInInput = new ClockInInput(),
    @Context() ctx: any,
  ): Promise<CarerShiftDto> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);
    return this.shiftService.clockIn(input, userId, userRole, organizationId, accessContext);
  }

  @Mutation(() => CarerShiftDto)
  @RequireCapabilities('FRONTLINE_SHIFT_EXECUTE')
  async clockOut(
    @Args('input', { type: () => ClockOutInput, nullable: true })
    input: ClockOutInput = new ClockOutInput(),
    @Context() ctx: any,
  ): Promise<CarerShiftDto> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);
    return this.shiftService.clockOut(input, userId, userRole, organizationId, accessContext);
  }

  @Query(() => ShiftAnalyticsDto)
  @RequireCapabilities('WORKFORCE_MANAGE')
  async shiftAnalytics(@Args() args: ShiftAnalyticsFilterArgs, @Context() ctx: any): Promise<ShiftAnalyticsDto> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);
    return this.shiftService.analytics(args.from, args.to, userId, userRole, organizationId, accessContext);
  }
}
