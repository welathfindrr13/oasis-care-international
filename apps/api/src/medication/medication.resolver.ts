import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@oasis/auth';
import { MedicationService } from './medication.service';
import { CreateMedicationInput } from './dto/create-medication.input';
import { CreatePrescriptionInput } from './dto/create-prescription.input';
import { RecordAdministrationInput } from './dto/record-administration.input';
import { MedicationFilterArgs } from './dto/medication-filter.args';
import { MedicationDto, MedicationListDto } from './dto/medication.dto';
import { PrescriptionDto } from './dto/prescription.dto';
import { MedicationAdministrationDto } from './dto/medication-administration.dto';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => 
  SetMetadata('roles', roles);

@Resolver()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MedicationResolver {
  constructor(private readonly medicationService: MedicationService) {}

  @Mutation(() => MedicationDto)
  async createMedication(
    @Args('input') input: CreateMedicationInput,
    @Context('req') req: any,
  ): Promise<MedicationDto> {
    const medication = await this.medicationService.createMedication(
      input,
      req.user.id,
      req.user.role,
    );
    return new MedicationDto(medication);
  }

  @Mutation(() => PrescriptionDto)
  async createPrescription(
    @Args('input') input: CreatePrescriptionInput,
    @Context('req') req: any,
  ): Promise<PrescriptionDto> {
    const prescription = await this.medicationService.createPrescription(
      input,
      req.user.id,
      req.user.role,
    );
    return new PrescriptionDto(prescription);
  }

  @Query(() => [MedicationAdministrationDto])
  async listDueMeds(
    @Args('visitId') visitId: string,
    @Context('req') req: any,
  ): Promise<MedicationAdministrationDto[]> {
    const administrations = await this.medicationService.listDueMeds(
      visitId,
      req.user.id,
      req.user.role,
    );
    return administrations.map(admin => new MedicationAdministrationDto(admin));
  }

  @Mutation(() => MedicationAdministrationDto)
  async recordAdministration(
    @Args('input') input: RecordAdministrationInput,
    @Context('req') req: any,
  ): Promise<MedicationAdministrationDto> {
    const administration = await this.medicationService.recordAdministration(
      input,
      req.user.id,
      req.user.role,
    );
    return new MedicationAdministrationDto(administration);
  }

  @Query(() => [MedicationAdministrationDto])
  async getTodaysMedicationsByClient(
    @Args('date') date: string,
    @Context('req') req: any,
  ): Promise<MedicationAdministrationDto[]> {
    const administrations = await this.medicationService.getTodaysMedicationsByClient(
      new Date(date),
      req.user.id,
      req.user.role,
    );
    return administrations.map(admin => new MedicationAdministrationDto(admin));
  }

  @Query(() => MedicationListDto)
  async medications(
    @Args() filter: MedicationFilterArgs,
    @Context('req') req: any,
  ): Promise<MedicationListDto> {
    const result = await this.medicationService.findMedications(
      filter,
      req.user.id,
      req.user.role,
    );
    return new MedicationListDto(result.items, result.total);
  }
}
