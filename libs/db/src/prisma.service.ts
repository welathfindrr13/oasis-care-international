import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
      log: configService.get<string>('NODE_ENV') === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
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
