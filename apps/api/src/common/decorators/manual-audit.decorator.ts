import { SetMetadata } from "@nestjs/common";

export const MANUAL_AUDIT_KEY = "oasis:manual-audit";

/**
 * Opts a handler out of the generic request/argument audit interceptor.
 * The handler's service must write a narrow, transactional audit event instead.
 */
export const ManualAudit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(MANUAL_AUDIT_KEY, true);
