import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';

// Configuration validation schema
const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').required(),
  JWT_SECRET: Joi.string().min(32).required(),
  DATABASE_URL: Joi.string().uri().required(),
  PORT: Joi.number().default(3000),
});

// Factory function to load configuration
// ECS injects secrets as environment variables from Secrets Manager
const configFactory = async () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  return {
    NODE_ENV: nodeEnv,
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: parseInt(process.env.PORT || '3000', 10),
  };
};

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.development', '.env.local', '.env'],
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      load: [configFactory],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
