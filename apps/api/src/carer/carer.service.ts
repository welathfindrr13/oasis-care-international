import { HttpStatus, Injectable } from '@nestjs/common';
import { CarerRepository } from './carer.repository';
import { CarerDTO } from './dto/carer.dto';
import { UpsertCarerInput } from './dto/upsert-carer.input';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';

@Injectable()
export class CarerService {
  constructor(
    private readonly carerRepository: CarerRepository,
  ) {}

  async findCarers(organizationId?: string): Promise<CarerDTO[]> {
    const orgId = await this.requireOrganizationId(organizationId);
    const carers = await this.carerRepository.findMany(orgId);
    return carers.map((carer) => ({
      id: carer.id,
      firstName: carer.first_name,
      lastName: carer.last_name,
      email: carer.email,
      phone: carer.phone,
    }));
  }

  async upsertCarer(input: UpsertCarerInput, organizationId?: string): Promise<CarerDTO> {
    const orgId = await this.requireOrganizationId(organizationId);
    const carer = await this.carerRepository.upsertById({
      organization_id: orgId,
      id: input.id,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      is_active: input.isActive ?? true,
    });

    return {
      id: carer.id,
      firstName: carer.first_name,
      lastName: carer.last_name,
      email: carer.email,
      phone: carer.phone,
    };
  }

  private async requireOrganizationId(organizationId?: string): Promise<string> {
    const orgId = (organizationId || '').trim();
    if (orgId) {
      return orgId;
    }

    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      'Organization context is required for this request',
      HttpStatus.FORBIDDEN,
    );
  }
}
