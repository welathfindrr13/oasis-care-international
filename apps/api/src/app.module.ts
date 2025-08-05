import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ClsModule } from 'nestjs-cls';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '@oasis/auth';
import { PrismaService } from '@oasis/db';
import { LoggerModule } from './logger/logger.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { VisitModule } from './visit/visit.module';
import { StatsModule } from './stats/stats.module';
import { MedicationModule } from './medication/medication.module';
import { formatGraphQLError } from './common/filters/graphql-error.filter';

@Module({
  imports: [
    MetricsModule,
    LoggerModule,
    HealthModule,
    ConfigModule.forRoot({ isGlobal: true }),
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
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    VisitModule,
    StatsModule,
    MedicationModule,
    // Add other feature modules here
  ],
  providers: [
    JwtStrategy,
    PrismaService,
  ],
})
export class AppModule {}
