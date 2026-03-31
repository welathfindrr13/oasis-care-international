import { Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(limit = 50) {
    return this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
