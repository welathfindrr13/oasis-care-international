import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { VisitService } from './visit.service';
import { VisitResolver } from './visit.resolver';
import { VisitRepository } from './visit.repository';
import { PrismaService } from '@oasis/db';

@Module({
  imports: [ClsModule],
  providers: [
    VisitService,
    VisitResolver,
    VisitRepository,
    PrismaService,
  ],
  exports: [VisitService],
})
export class VisitModule {}
