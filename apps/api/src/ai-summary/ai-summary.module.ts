import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { MedicationModule } from '../medication/medication.module';
import { EmbeddingBatchService } from './embeddings/embedding.batch';
import { AiSummaryResolver } from './ai-summary.resolver';
import { AiSummaryService } from './ai-summary.service';
import { AiSummaryRepository } from './ai-summary.repository';

@Module({
  imports: [DbModule, MedicationModule],
  providers: [
    EmbeddingBatchService,
    AiSummaryResolver,
    AiSummaryService,
    AiSummaryRepository,
  ],
  exports: [
    EmbeddingBatchService,
    AiSummaryService,
  ],
})
export class AiSummaryModule {}
