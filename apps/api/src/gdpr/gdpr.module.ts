import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { GdprController } from './gdpr.controller';
import { ConsentService } from './services/consent.service';
import { SarService } from './services/sar.service';
import { ErasureService } from './services/erasure.service';

@Module({
  imports: [DbModule],
  controllers: [GdprController],
  providers: [ConsentService, SarService, ErasureService],
  exports: [ConsentService, SarService, ErasureService],
})
export class GdprModule {}
