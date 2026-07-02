import { HttpStatus } from '@nestjs/common';
import { BaseHttpException } from '../errors/base-http.exception';
import { ErrorCode } from '../errors/error-codes';

type SensitiveWriteData = {
  [key: string]: unknown;
  organization_id?: unknown;
  organization?: {
    connect?: {
      id?: unknown;
    } | null;
  } | null;
};

export function assertTenantIdForSensitiveWrite(modelName: string, organizationId: unknown): string {
  const tenantId = typeof organizationId === 'string' ? organizationId.trim() : '';
  if (tenantId) {
    return tenantId;
  }

  throw new BaseHttpException(
    ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
    `Organization context is required for ${modelName}`,
    HttpStatus.FORBIDDEN,
  );
}

export function assertTenantOwnershipForSensitiveWrite(modelName: string, data: SensitiveWriteData): string {
  const directTenant = typeof data?.organization_id === 'string' ? data.organization_id : undefined;
  const relationTenant =
    typeof data?.organization?.connect?.id === 'string' ? data.organization.connect.id : undefined;

  return assertTenantIdForSensitiveWrite(modelName, directTenant ?? relationTenant);
}
