import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ApiRolesGuard } from '../auth/api-roles.guard';
import { GdprController } from './gdpr.controller';
import { REQUIRED_ACCESS_CAPABILITIES } from '../auth/access-capability';

describe('GdprController access control', () => {
  const consentService = {
    grantConsent: jest.fn(),
    withdrawConsent: jest.fn(),
    getConsentStatus: jest.fn(),
    getConsentHistory: jest.fn(),
    hasConsent: jest.fn(),
  };
  const sarService = {
    enqueueSubjectAccessRequest: jest.fn(),
  };
  const erasureService = {
    enqueueDataErasure: jest.fn(),
  };

  let controller: GdprController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new GdprController(
      consentService as any,
      sarService as any,
      erasureService as any,
    );
  });

  it('uses the API roles guard on the whole GDPR controller', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, GdprController) ?? [];

    expect(guards).toContain(ApiRolesGuard);
  });

  it('limits GDPR endpoints through the canonical GDPR capability', () => {
    const capabilities =
      Reflect.getMetadata(REQUIRED_ACCESS_CAPABILITIES, GdprController) ?? [];

    expect(capabilities).toEqual(['GDPR_MANAGE']);
  });

  it('rejects unauthenticated SAR requests before enqueueing', async () => {
    await expect(
      (controller.requestSubjectAccessReport as any)(
        { user: undefined },
        { userId: 'client-1', requestType: 'full' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sarService.enqueueSubjectAccessRequest).not.toHaveBeenCalled();
  });

  it('rejects non-admin and non-manager erasure requests', async () => {
    await expect(
      (controller.requestDataErasure as any)(
        { user: { id: 'family-1', role: 'user' } },
        { userId: 'client-1', requestType: 'full', reason: 'subject request' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(erasureService.enqueueDataErasure).not.toHaveBeenCalled();
  });

  it('allows managers to enqueue erasure requests for a documented subject', async () => {
    erasureService.enqueueDataErasure.mockResolvedValue({
      requestId: 'erase-1',
    });

    await expect(
      (controller.requestDataErasure as any)(
        {
          user: {
            id: 'manager-1',
            role: 'carer',
            organizationId: 'org-1',
            accessContext: { effectiveRole: 'manager', surface: 'STAFF' },
          },
        },
        { userId: 'client-1', requestType: 'full', reason: 'subject request' },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        requestId: 'erase-1',
        status: 'accepted',
      }),
    );

    expect(erasureService.enqueueDataErasure).toHaveBeenCalledWith(
      'org-1',
      'client-1',
      'full',
      'subject request',
    );
  });

  it('rejects GDPR operations without organisation context', async () => {
    await expect(
      (controller.requestSubjectAccessReport as any)(
        {
          user: {
            id: 'admin-1',
            role: 'admin',
            accessContext: { effectiveRole: 'admin', surface: 'ADMIN' },
          },
        },
        { userId: 'client-1', requestType: 'full' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(sarService.enqueueSubjectAccessRequest).not.toHaveBeenCalled();
  });
});
