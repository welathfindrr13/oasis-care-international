import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ClsModule } from 'nestjs-cls';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '@oasis/auth';
import { PrismaService } from '@oasis/db';
import { LoggerModule } from './logger/logger.module';
import { HealthModule } from './health/health.module';
import { MetricsDynamicModule } from './metrics/metrics.dynamic.module';
import { VisitModule } from './visit/visit.module';
import { StatsModule } from './stats/stats.module';
import { MedicationModule } from './medication/medication.module';
import { formatGraphQLError } from './common/filters/graphql-error.filter';
import { GdprModule } from './gdpr/gdpr.module';
import { DemoModule } from './demo/demo.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    MetricsDynamicModule.register(process.env.METRICS_ENABLED === 'true'),
    LoggerModule,
    HealthModule,
    ConfigModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req) => {
          cls.set('requestId', `${Date.now()}-${Math.random()}`);
        },
      },
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      formatError: formatGraphQLError,
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
    VisitModule,
    StatsModule,
    MedicationModule,
    DemoModule,
    // GDPR module (feature-flagged)
    ...(process.env.GDPR_ENABLED === 'true' ? [GdprModule] : []),
    // Add other feature modules here
  ],
  providers: [
    JwtStrategy,
    PrismaService,
    AuditLogInterceptor,
  ],
})
export class AppModule {}
