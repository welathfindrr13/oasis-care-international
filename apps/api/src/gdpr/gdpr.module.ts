import { Module } from '@nestjs/common';
import { GdprController } from './gdpr.controller';
import { ConsentService } from './services/consent.service';
import { SarService } from './services/sar.service';
import { ErasureService } from './services/erasure.service';

@Module({
  controllers: [GdprController],
  providers: [ConsentService, SarService, ErasureService],
  exports: [ConsentService, SarService, ErasureService],
})
export class GdprModule {}
