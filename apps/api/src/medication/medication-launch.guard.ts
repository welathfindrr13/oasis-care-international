import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { assertMedicationEmarEnabled } from '../common/features/medication-emar';

@Injectable()
export class MedicationLaunchGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    assertMedicationEmarEnabled();
    return true;
  }
}
