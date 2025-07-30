import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private configService;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    enableShutdownHooks(app: any): Promise<void>;
    excludeDeleted<T extends {
        deleted_at: Date | null;
    }>(records: T[]): T[];
    whereNotDeleted(where?: any): any;
    softDelete(model: string, id: string): Promise<any>;
}
