import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { GdprController } from './gdpr.controller';
import { ConsentService } from './services/consent.service';
import { SarService } from './services/sar.service';
import { ErasureService } from './services/erasure.service';
import { RetentionService } from './services/retention.service';
import { ComplianceService } from './services/compliance.service';

@Module({
  imports: [DbModule],
  controllers: [GdprController],
  providers: [ConsentService, SarService, ErasureService, RetentionService, ComplianceService],
  exports: [ConsentService, SarService, ErasureService, RetentionService, ComplianceService],
})
export class GdprModule {}
