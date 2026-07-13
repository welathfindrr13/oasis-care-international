import { Module } from "@nestjs/common";
import { ClsModule } from "nestjs-cls";
import { VisitService } from "./visit.service";
import { VisitResolver } from "./visit.resolver";
import { VisitRepository } from "./visit.repository";
import { PrismaService } from "@oasis/db";
import { CareLogModule } from "../care-log/care-log.module";
import { CarerModule } from "../carer/carer.module";
import { VisitCompletionProofKeyring } from "./visit-completion-proof-keyring";
@Module({
  imports: [ClsModule, CareLogModule, CarerModule],
  providers: [
    VisitService,
    VisitResolver,
    VisitRepository,
    VisitCompletionProofKeyring,
    PrismaService,
  ],
  exports: [VisitService],
})
export class VisitModule {}
