import { GUARDS_METADATA } from '@nestjs/common/constants';
import { GqlJwtAuthGuard } from '../auth/gql-jwt-auth.guard';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { MedicationLaunchGuard } from './medication-launch.guard';
import { MedicationResolver } from './medication.resolver';

describe('MedicationResolver launch boundary', () => {
  it('authenticates before checking the launch boundary and authorizing roles', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MedicationResolver)).toEqual([
      GqlJwtAuthGuard,
      MedicationLaunchGuard,
      GqlRolesGuard,
    ]);
  });
});
