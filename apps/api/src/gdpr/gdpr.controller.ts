import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ConsentService } from './services/consent.service';
import { SarService } from './services/sar.service';
import { ErasureService } from './services/erasure.service';

interface ConsentRequestDto {
  userId: string;
  consentType: string;
  purpose: string;
  granted: boolean;
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

  @Post('consent')
  @HttpCode(HttpStatus.ACCEPTED)
  async grantOrWithdrawConsent(@Body() request: ConsentRequestDto) {
    // Stub implementation - returns 202 Accepted
    return {
      message: 'Consent request received and being processed',
      requestId: `consent-${Date.now()}`,
      status: 'accepted'
    };
  }

  @Post('sar')
  @HttpCode(HttpStatus.ACCEPTED) 
  async requestSubjectAccessReport(@Body() request: SarRequestDto) {
    // Stub implementation - returns 202 Accepted
    return {
      message: 'Subject Access Request received and being processed',
      requestId: `sar-${Date.now()}`,
      status: 'accepted',
      estimatedCompletion: '30 days'
    };
  }

  @Post('erasure')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDataErasure(@Body() request: ErasureRequestDto) {
    // Stub implementation - returns 202 Accepted
    return {
      message: 'Data erasure request received and being processed',
      requestId: `erasure-${Date.now()}`,
      status: 'accepted',
      estimatedCompletion: '30 days'
    };
  }
}
