import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ApiRolesGuard } from '../auth/api-roles.guard';
import { GdprController } from './gdpr.controller';

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

  it('limits GDPR endpoints to admin and manager roles', () => {
    const roles = Reflect.getMetadata('roles', GdprController) ?? [];

    expect(roles).toEqual(expect.arrayContaining(['admin', 'manager']));
    expect(roles).not.toContain('user');
    expect(roles).not.toContain('carer');
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
        { user: { id: 'manager-1', role: 'manager' } },
        { userId: 'client-1', requestType: 'full', reason: 'subject request' },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        requestId: 'erase-1',
        status: 'accepted',
      }),
    );

    expect(erasureService.enqueueDataErasure).toHaveBeenCalledWith(
      'client-1',
      'full',
      'subject request',
    );
  });
});
