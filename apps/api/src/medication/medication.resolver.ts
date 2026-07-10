import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { MedicationService } from './medication.service';
import { CreateMedicationInput } from './dto/create-medication.input';
import { CreatePrescriptionInput } from './dto/create-prescription.input';
import { RecordAdministrationInput } from './dto/record-administration.input';
import { MedicationFilterArgs } from './dto/medication-filter.args';
import { MedicationDto, MedicationListDto } from './dto/medication.dto';
import { PrescriptionDto } from './dto/prescription.dto';
import { MedicationAdministrationDto } from './dto/medication-administration.dto';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';
import { requireOperationalActor } from '../carer/carer-access.service';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => SetMetadata('roles', roles);

@Resolver()
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class MedicationResolver {
  constructor(private readonly medicationService: MedicationService) {}

  private getUserContext(req: any): {
    userId: string;
    userRole: string;
    organizationId?: string;
    authSubject: string;
  } {
    return requireOperationalActor(req?.user);
  }

  @Mutation(() => MedicationDto)
  @Roles('admin')
  async createMedication(
    @Args('input') input: CreateMedicationInput,
    @Context('req') req: any,
  ): Promise<MedicationDto> {
    const { userId, userRole, organizationId } = this.getUserContext(req);
    const medication = await this.medicationService.createMedication(input, userId, userRole, organizationId);
    return new MedicationDto(medication);
  }

  @Mutation(() => PrescriptionDto)
  @Roles('admin')
  async createPrescription(
    @Args('input') input: CreatePrescriptionInput,
    @Context('req') req: any,
  ): Promise<PrescriptionDto> {
    const { userId, userRole, organizationId } = this.getUserContext(req);
    const prescription = await this.medicationService.createPrescription(input, userId, userRole, organizationId);
    return new PrescriptionDto(prescription);
  }

  @Query(() => [MedicationAdministrationDto])
  @Roles('admin', 'carer')
  async listDueMeds(
    @Args('visitId') visitId: string,
    @Context('req') req: any,
  ): Promise<MedicationAdministrationDto[]> {
    const { userId, userRole, organizationId } = this.getUserContext(req);
    const administrations = await this.medicationService.listDueMeds(visitId, userId, userRole, organizationId);
    return administrations.map((admin) => new MedicationAdministrationDto(admin));
  }

  @Mutation(() => MedicationAdministrationDto)
  @Roles('admin', 'carer')
  async recordAdministration(
    @Args('input') input: RecordAdministrationInput,
    @Context('req') req: any,
  ): Promise<MedicationAdministrationDto> {
    const { userId, userRole, organizationId, authSubject } = this.getUserContext(req);
    const administration = await this.medicationService.recordAdministration(
      input,
      userId,
      userRole,
      organizationId,
      authSubject,
    );
    return new MedicationAdministrationDto(administration);
  }

  @Query(() => [MedicationAdministrationDto])
  @Roles('admin', 'carer')
  async getTodaysMedicationsByClient(
    @Args('date') date: string,
    @Context('req') req: any,
  ): Promise<MedicationAdministrationDto[]> {
    const { userId, userRole, organizationId } = this.getUserContext(req);
    const administrations = await this.medicationService.getTodaysMedicationsByClient(
      new Date(date),
      userId,
      userRole,
      organizationId,
    );
    return administrations.map((admin) => new MedicationAdministrationDto(admin));
  }

  @Query(() => MedicationListDto)
  @Roles('admin', 'carer')
  async medications(@Args() filter: MedicationFilterArgs, @Context('req') req: any): Promise<MedicationListDto> {
    const { userId, userRole, organizationId } = this.getUserContext(req);
    const result = await this.medicationService.findMedications(filter, userId, userRole, organizationId);
    return new MedicationListDto(result.items, result.total);
  }
}
