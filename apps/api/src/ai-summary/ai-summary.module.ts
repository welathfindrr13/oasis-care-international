import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { EmbeddingBatchService } from './embeddings/embedding.batch';

@Module({
  imports: [DbModule],
  providers: [EmbeddingBatchService],
  exports: [EmbeddingBatchService],
})
export class AiSummaryModule {}
