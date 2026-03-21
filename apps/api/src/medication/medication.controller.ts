import { Controller, Get, Query, Req, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@oasis/auth';
import { MedicationService } from './medication.service';
import { MedicationAdministrationDto } from './dto/medication-administration.dto';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

@Controller('medication')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MedicationController {
  constructor(private readonly medicationService: MedicationService) {}

  @Get('today')
  @Roles('admin', 'office', 'carer')
  async getTodaysMedicationsByClient(
    @Query('date') date: string,
    @Req() req: any,
  ): Promise<MedicationAdministrationDto[]> {
    const parsedDate = new Date(date);
    const userId = req.user?.id ?? req.user?.sub;
    const userRole = req.user?.role ?? req.user?.roles?.[0] ?? 'user';

    const administrations = await this.medicationService.getTodaysMedicationsByClient(
      parsedDate,
      userId,
      userRole,
    );

    return administrations.flatMap((administration) => {
      try {
        return [new MedicationAdministrationDto(administration)];
      } catch {
        return [];
      }
    });
  }
}
