import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ConsentService, GrantConsentInput } from './services/consent.service';
import { SarService } from './services/sar.service';
import { ErasureService } from './services/erasure.service';

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
  async grantOrWithdrawConsent(@Body() request: ConsentRequestDto) {
    if (request.granted) {
      const input: GrantConsentInput = {
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
  async getConsentStatus(@Param('userId') userId: string) {
    const status = await this.consentService.getConsentStatus(userId);
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
  async getConsentHistory(@Param('userId') userId: string) {
    const history = await this.consentService.getConsentHistory(userId);
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
    @Param('userId') userId: string,
    @Query('type') consentType: string,
  ) {
    const hasConsent = await this.consentService.hasConsent(userId, consentType);
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
  async requestSubjectAccessReport(@Body() request: SarRequestDto) {
    const result = await this.sarService.enqueueSubjectAccessRequest(
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
  async requestDataErasure(@Body() request: ErasureRequestDto) {
    const result = await this.erasureService.enqueueDataErasure(
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
}
