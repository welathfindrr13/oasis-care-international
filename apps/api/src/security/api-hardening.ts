import {
  HttpStatus,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface ApiHardeningOptions {
  jsonBodyLimit?: string;
  urlencodedBodyLimit?: string;
  urlencodedParameterLimit?: number;
  rateLimit?: RateLimitConfig;
}

const DEFAULT_JSON_BODY_LIMIT = '256kb';
const DEFAULT_URLENCODED_BODY_LIMIT = '64kb';
const DEFAULT_URLENCODED_PARAMETER_LIMIT = 100;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 300;
const DEFAULT_COMPANY_REQUEST_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const DEFAULT_COMPANY_REQUEST_RATE_LIMIT_MAX = 5;
const RATE_LIMIT_EXEMPT_PROBE_PATHS = new Set([
  '/health',
  '/ready',
  '/healthz',
]);

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getGraphQLSecurityOptions(nodeEnv = process.env.NODE_ENV) {
  const enabled = nodeEnv !== 'production';

  return {
    introspection: enabled,
    playground: enabled,
  };
}

export function getApiHardeningOptions(
  env: NodeJS.ProcessEnv = process.env,
): Required<ApiHardeningOptions> {
  return {
    jsonBodyLimit: env.API_JSON_BODY_LIMIT || DEFAULT_JSON_BODY_LIMIT,
    urlencodedBodyLimit:
      env.API_URLENCODED_BODY_LIMIT || DEFAULT_URLENCODED_BODY_LIMIT,
    urlencodedParameterLimit: readPositiveInteger(
      env.API_URLENCODED_PARAMETER_LIMIT,
      DEFAULT_URLENCODED_PARAMETER_LIMIT,
    ),
    rateLimit: {
      windowMs: readPositiveInteger(
        env.API_RATE_LIMIT_WINDOW_MS,
        DEFAULT_RATE_LIMIT_WINDOW_MS,
      ),
      max: readPositiveInteger(env.API_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    },
  };
}

export function createApiValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    forbidUnknownValues: false,
    validationError: {
      target: false,
      value: false,
    },
    exceptionFactory: (errors: ValidationError[] = []) => {
      const details = errors
        .flatMap((error) => {
          const constraints = error?.constraints
            ? Object.values(error.constraints)
            : [];
          if (!constraints.length) return [];
          return constraints.map((msg) => `${error.property}: ${msg}`);
        })
        .slice(0, 5);

      const message =
        details.length > 0
          ? `Validation failed: ${details.join('; ')}`
          : 'Validation failed';

      return new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        message,
        HttpStatus.BAD_REQUEST,
      );
    },
  });
}

export function applyApiHardening(
  app: INestApplication,
  overrides: ApiHardeningOptions = {},
): void {
  const defaults = getApiHardeningOptions();
  const options = {
    ...defaults,
    ...overrides,
    rateLimit: {
      ...defaults.rateLimit,
      ...overrides.rateLimit,
    },
  };

  const httpInstance = app.getHttpAdapter().getInstance() as {
    disable?: (setting: string) => void;
  };

  if (typeof httpInstance?.disable === 'function') {
    httpInstance.disable('x-powered-by');
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use((req: any, res: any, next: () => void) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(self)',
    );
    next();
  });
  app.use(
    rateLimit({
      windowMs: options.rateLimit.windowMs,
      limit: options.rateLimit.max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (request) =>
        request.method === 'GET' &&
        RATE_LIMIT_EXEMPT_PROBE_PATHS.has(request.path),
      message: {
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too many requests',
      },
    }),
  );

  const expressApp = app as NestExpressApplication;
  expressApp.useBodyParser('json', { limit: options.jsonBodyLimit });
  expressApp.useBodyParser('urlencoded', {
    limit: options.urlencodedBodyLimit,
    parameterLimit: options.urlencodedParameterLimit,
    extended: true,
  });
}

export function createCompanyAccessRequestRateLimiter(
  env: NodeJS.ProcessEnv = process.env,
) {
  return rateLimit({
    windowMs: readPositiveInteger(
      env.COMPANY_ACCESS_REQUEST_RATE_LIMIT_WINDOW_MS,
      DEFAULT_COMPANY_REQUEST_RATE_LIMIT_WINDOW_MS,
    ),
    limit: readPositiveInteger(
      env.COMPANY_ACCESS_REQUEST_RATE_LIMIT_MAX,
      DEFAULT_COMPANY_REQUEST_RATE_LIMIT_MAX,
    ),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many requests',
    },
  });
}
