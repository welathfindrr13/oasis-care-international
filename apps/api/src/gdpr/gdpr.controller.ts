import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  SetMetadata,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { RolesGuard } from '@oasis/auth';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { ConsentService, GrantConsentInput } from './services/consent.service';
import { SarService } from './services/sar.service';
import { ErasureService } from './services/erasure.service';
import { ConsentRequestDto } from './dto/consent-request.dto';
import { SarRequestDto } from './dto/sar-request.dto';
import { ErasureRequestDto } from './dto/erasure-request.dto';
import { GdprListQueryDto } from './dto/gdpr-list-query.dto';
import { RetentionService } from './services/retention.service';
import { ComplianceService } from './services/compliance.service';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

@Controller('gdpr')
@UseInterceptors(AuditLogInterceptor)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'office')
export class GdprController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly sarService: SarService,
    private readonly erasureService: ErasureService,
    private readonly retentionService: RetentionService,
    private readonly complianceService: ComplianceService,
  ) {}

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

  @Get('consent/:userId')
  async getConsentStatus(@Param('userId') userId: string) {
    const status = await this.consentService.getConsentStatus(userId);
    return {
      userId,
      consents: status,
    };
  }

  @Get('consent/:userId/history')
  async getConsentHistory(@Param('userId') userId: string) {
    const history = await this.consentService.getConsentHistory(userId);
    return {
      userId,
      history,
    };
  }

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

  @Get('sar')
  async listSubjectAccessRequests(@Query() query: GdprListQueryDto) {
    return {
      requests: await this.sarService.listSubjectAccessRequests(query.limit),
    };
  }

  @Post('sar')
  @HttpCode(HttpStatus.ACCEPTED) 
  async requestSubjectAccessReport(@Body() request: SarRequestDto, @Req() req: any) {
    const requestedBy = req.user?.sub ?? req.user?.id ?? 'unknown';
    const result = await this.sarService.enqueueSubjectAccessRequest(
      request.userId,
      request.requestType,
      request.email,
      requestedBy,
    );
    
    return {
      message: 'Subject Access Request received and being processed',
      requestId: result.requestId,
      status: 'accepted',
      estimatedCompletion: '30 days',
    };
  }

  @Get('sar/:requestId')
  async getSubjectAccessReportStatus(@Param('requestId') requestId: string) {
    return this.sarService.getSarStatus(requestId);
  }

  @Post('sar/:requestId/process')
  async processSubjectAccessReport(@Param('requestId') requestId: string) {
    return this.sarService.processSubjectAccessRequest(requestId);
  }

  @Get('sar/:requestId/download')
  async downloadSubjectAccessReport(
    @Param('requestId') requestId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const artifact = await this.sarService.downloadSubjectAccessReport(requestId);
    response.setHeader('Content-Type', artifact.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${artifact.fileName}"`);

    return artifact.file;
  }

  @Get('erasure')
  async listErasureRequests(@Query() query: GdprListQueryDto) {
    return {
      requests: await this.erasureService.listErasureRequests(query.limit),
    };
  }

  @Post('erasure')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestDataErasure(@Body() request: ErasureRequestDto, @Req() req: any) {
    const requestedBy = req.user?.sub ?? req.user?.id ?? 'unknown';
    const result = await this.erasureService.enqueueDataErasure(
      request.userId,
      request.requestType,
      request.reason,
      requestedBy,
    );
    
    return {
      message: 'Data erasure request received and being processed',
      requestId: result.requestId,
      status: 'accepted',
      estimatedCompletion: '30 days',
    };
  }

  @Get('erasure/:requestId')
  async getErasureStatus(@Param('requestId') requestId: string) {
    return this.erasureService.getErasureStatus(requestId);
  }

  @Post('erasure/:requestId/process')
  async processErasureRequest(@Param('requestId') requestId: string) {
    return this.erasureService.processDataErasure(requestId);
  }

  @Post('erasure/:requestId/cancel')
  async cancelErasureRequest(@Param('requestId') requestId: string) {
    return this.erasureService.cancelErasureRequest(requestId);
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() query: GdprListQueryDto) {
    return {
      logs: await this.complianceService.listAuditLogs(query.limit),
    };
  }

  @Get('retention-policies')
  async getRetentionPolicies() {
    return {
      policies: await this.retentionService.listPolicies(),
    };
  }

  @Post('retention-policies/enforce')
  async enforceRetentionPolicies() {
    return this.retentionService.enforcePolicies();
  }
}
