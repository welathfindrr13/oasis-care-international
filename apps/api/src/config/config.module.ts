import { Module, Global } from "@nestjs/common";
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from "@nestjs/config";
import * as Joi from "joi";

// Configuration validation schema
export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "staging", "production")
    .required(),
  JWT_SECRET: Joi.string().min(32).required(),
  VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)
    .required(),
  VISIT_COMPLETION_PROOF_ACTIVE_SECRET: Joi.string().trim().min(32).required(),
  VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: Joi.string()
    .trim()
    .empty("")
    .pattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)
    .optional(),
  VISIT_COMPLETION_PROOF_PREVIOUS_SECRET: Joi.string()
    .trim()
    .empty("")
    .min(32)
    .optional(),
  DATABASE_URL: Joi.string().required(),
  PORT: Joi.number().default(3000),
})
  .and(
    "VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID",
    "VISIT_COMPLETION_PROOF_PREVIOUS_SECRET",
  )
  .custom((value, helpers) => {
    if (
      value.VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID &&
      value.VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID ===
        value.VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID
    ) {
      return helpers.error("visitProof.keyIdCollision");
    }
    if (
      value.VISIT_COMPLETION_PROOF_PREVIOUS_SECRET &&
      value.VISIT_COMPLETION_PROOF_PREVIOUS_SECRET ===
        value.VISIT_COMPLETION_PROOF_ACTIVE_SECRET
    ) {
      return helpers.error("visitProof.secretCollision");
    }
    return value;
  }, "visit completion proof key-ring validation");

// Factory function to load configuration
// ECS injects secrets as environment variables from Secrets Manager
const configFactory = async () => {
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    NODE_ENV: nodeEnv,
    JWT_SECRET: process.env.JWT_SECRET,
    VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID:
      process.env.VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID,
    VISIT_COMPLETION_PROOF_ACTIVE_SECRET:
      process.env.VISIT_COMPLETION_PROOF_ACTIVE_SECRET,
    VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID:
      process.env.VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID,
    VISIT_COMPLETION_PROOF_PREVIOUS_SECRET:
      process.env.VISIT_COMPLETION_PROOF_PREVIOUS_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: parseInt(process.env.PORT || "3000", 10),
  };
};

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env.development", ".env.local", ".env"],
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
