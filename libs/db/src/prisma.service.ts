import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './generated/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    // Read directly from process.env to avoid ConfigService timing issues
    const databaseUrl = process.env.DATABASE_URL;
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    console.log(`>>> PrismaService: DATABASE_URL ${databaseUrl ? 'is set' : 'IS MISSING'}`);
    
    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: nodeEnv === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
    // NOTE: Prisma connects lazily on first query - no blocking $connect() at startup
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: any) {
    // Note: $on is deprecated in newer Prisma versions
    // For now, we'll comment this out
    // this.$on('beforeExit', async () => {
    //   await app.close();
    // });
  }

  // Helper method for soft deletes
  excludeDeleted<T extends { deleted_at: Date | null }>(
    records: T[]
  ): T[] {
    return records.filter((record) => record.deleted_at === null);
  }

  // Helper for building soft delete where clause
  whereNotDeleted(where: any = {}) {
    return {
      ...where,
      deleted_at: null,
    };
  }

  // Helper for soft delete operation
  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
