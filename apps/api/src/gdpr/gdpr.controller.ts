import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConsentService, GrantConsentInput } from './services/consent.service';
import { SarService } from './services/sar.service';
import { ErasureService } from './services/erasure.service';
import { ApiRolesGuard } from '../auth/api-roles.guard';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

type GdprActor = {
  id?: string | null;
  sub?: string | null;
  role?: string | null;
  organizationId?: string | null;
  realm_access?: {
    roles?: unknown;
  } | null;
};

interface ConsentRequestDto {
  userId: string;
  consentType: string;
  purpose: string;
  legalBasis: string;
  granted: boolean;
  metadata?: Record<string, any>;
}

interface SarRequestDto {
  userId: string;
  requestType: string;
  email?: string;
}

interface ErasureRequestDto {
  userId: string;
  requestType: string;
  reason?: string;
}

@Controller('gdpr')
@UseGuards(ApiRolesGuard)
@Roles('admin', 'manager')
export class GdprController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly sarService: SarService,
    private readonly erasureService: ErasureService,
  ) {}

  /**
   * Grant or withdraw consent
   * POST /gdpr/consent
   */
  @Post('consent')
  @HttpCode(HttpStatus.ACCEPTED)
  async grantOrWithdrawConsent(
    @Req() req: { user?: GdprActor },
    @Body() request: ConsentRequestDto,
  ) {
    const organizationId = this.assertGdprStaffAccess(req.user);

    if (request.granted) {
      const input: GrantConsentInput = {
        organizationId,
        userId: request.userId,
        consentType: request.consentType,
        purpose: request.purpose,
        legalBasis: request.legalBasis,
        metadata: request.metadata,
      };
      
      const record = await this.consentService.grantConsent(input);
      
      return {
        message: 'Consent granted successfully',
        requestId: `consent-${record.id}`,
        status: 'granted',
        record,
      };
    } else {
      const record = await this.consentService.withdrawConsent(
        organizationId,
        request.userId,
        request.consentType,
      );
      
      return {
        message: 'Consent withdrawn successfully',
        requestId: `consent-${record.id}`,
        status: 'withdrawn',
        record,
      };
    }
  }

  /**
   * Get consent status for a user
   * GET /gdpr/consent/:userId
   */
  @Get('consent/:userId')
  async getConsentStatus(
    @Req() req: { user?: GdprActor },
    @Param('userId') userId: string,
  ) {
    const organizationId = this.assertGdprStaffAccess(req.user);

    const status = await this.consentService.getConsentStatus(organizationId, userId);
    return {
      userId,
      consents: status,
    };
  }

  /**
   * Get consent history for a user
   * GET /gdpr/consent/:userId/history
   */
  @Get('consent/:userId/history')
  async getConsentHistory(
    @Req() req: { user?: GdprActor },
    @Param('userId') userId: string,
  ) {
    const organizationId = this.assertGdprStaffAccess(req.user);

    const history = await this.consentService.getConsentHistory(organizationId, userId);
    return {
      userId,
      history,
    };
  }

  /**
   * Check if user has specific consent
   * GET /gdpr/consent/:userId/check?type=marketing
   */
  @Get('consent/:userId/check')
  async checkConsent(
    @Req() req: { user?: GdprActor },
    @Param('userId') userId: string,
    @Query('type') consentType: string,
  ) {
    const organizationId = this.assertGdprStaffAccess(req.user);

    const hasConsent = await this.consentService.hasConsent(organizationId, userId, consentType);
    return {
      userId,
      consentType,
      hasConsent,
    };
  }

  /**
   * Request Subject Access Report
   * POST /gdpr/sar
   */
  @Post('sar')
  @HttpCode(HttpStatus.ACCEPTED) 
  async requestSubjectAccessReport(
    @Req() req: { user?: GdprActor },
    @Body() request: SarRequestDto,
  ) {
    const organizationId = this.assertGdprStaffAccess(req.user);

    const result = await this.sarService.enqueueSubjectAccessRequest(
      organizationId,
      request.userId,
      request.requestType,
      request.email,
    );
    
    return {
      message: 'Subject Access Request received and being processed',
      requestId: result.requestId,
      status: 'accepted',
      estimatedCompletion: '30 days',
    };
  }

  /**
   * Request Data Erasure
   * POST /gdpr/erasure
   */
  @Post('erasure')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDataErasure(
    @Req() req: { user?: GdprActor },
    @Body() request: ErasureRequestDto,
  ) {
    const organizationId = this.assertGdprStaffAccess(req.user);

    const result = await this.erasureService.enqueueDataErasure(
      organizationId,
      request.userId,
      request.requestType,
      request.reason,
    );
    
    return {
      message: 'Data erasure request received and being processed',
      requestId: result.requestId,
      status: 'accepted',
      estimatedCompletion: '30 days',
    };
  }

  private assertGdprStaffAccess(actor?: GdprActor): string {
    if (!actor) {
      throw new UnauthorizedException('GDPR requests require authentication');
    }

    const roles = new Set<string>();
    if (typeof actor.role === 'string' && actor.role.trim().length > 0) {
      roles.add(actor.role.toLowerCase().trim());
    }

    if (Array.isArray(actor.realm_access?.roles)) {
      for (const role of actor.realm_access.roles) {
        const normalized = String(role || '')
          .toLowerCase()
          .trim();
        if (normalized) {
          roles.add(normalized);
        }
      }
    }

    if (roles.has('admin') || roles.has('manager')) {
      const organizationId = (actor.organizationId || '').trim();
      if (!organizationId) {
        throw new ForbiddenException('Organization context is required for GDPR operations.');
      }
      return organizationId;
    }

    throw new ForbiddenException(
      'GDPR endpoints are restricted to authorised managers and administrators until subject/representative access is implemented.',
    );
  }
}
