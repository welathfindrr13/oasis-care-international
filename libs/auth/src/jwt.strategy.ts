import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { createPublicKey } from 'crypto';
import { extractRoles, primaryRole } from './role-utils';

export interface JwtPayload {
  sub: string;
  preferred_username: string;
  username?: string;
  email?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };
  'cognito:groups'?: string[];
  groups?: string[];
  roles?: string[];
  iss?: string;
  exp: number;
  iat: number;
}

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwksResponse = {
  keys?: Array<JsonWebKey & { kid?: string }>;
};

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedJwksAt = 0;
const cachedKeys = new Map<string, string>();

function decodeJwtSection<T>(token: string, index: number): T {
  const section = token.split('.')[index];
  if (!section) {
    throw new Error('Invalid JWT format');
  }

  const normalized = section.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as T;
}

function getIssuer(payload: JwtPayload): string | undefined {
  return process.env.OIDC_ISSUER || process.env.COGNITO_ISSUER || payload.iss;
}

function getJwksUri(payload: JwtPayload): string {
  if (process.env.JWKS_URI) {
    return process.env.JWKS_URI;
  }

  const issuer = getIssuer(payload);
  if (!issuer) {
    throw new Error('OIDC issuer is not configured');
  }

  return `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
}

async function fetchSigningKey(token: string): Promise<string> {
  const header = decodeJwtSection<JwtHeader>(token, 0);
  if (header.alg?.startsWith('HS')) {
    const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret-key-for-oasis-testing-only' : undefined);
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return secret;
  }

  const payload = decodeJwtSection<JwtPayload>(token, 1);
  const kid = header.kid;
  if (!kid) {
    throw new Error('JWT kid is missing');
  }

  if (Date.now() - cachedJwksAt > JWKS_CACHE_TTL_MS) {
    cachedKeys.clear();
    cachedJwksAt = 0;
  }

  const cached = cachedKeys.get(kid);
  if (cached) {
    return cached;
  }

  const response = await fetch(getJwksUri(payload));
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  const { keys = [] } = (await response.json()) as JwksResponse;
  for (const jwk of keys) {
    if (!jwk.kid) {
      continue;
    }

    const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' })
      .toString();
    cachedKeys.set(jwk.kid, publicKey);
  }
  cachedJwksAt = Date.now();

  const signingKey = cachedKeys.get(kid);
  if (!signingKey) {
    throw new Error(`No signing key found for kid ${kid}`);
  }

  return signingKey;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'RS256'],
      secretOrKeyProvider: (_request, rawJwtToken, done) => {
        fetchSigningKey(rawJwtToken)
          .then((key) => done(null, key))
          .catch((error) => done(error as Error));
      },
    };
    super(options);
  }

  async validate(payload: JwtPayload): Promise<any> {
    const roles = extractRoles(payload);
    const role = primaryRole(payload);
    
    return {
      id: payload.sub,  // Map sub to id for resolver compatibility
      sub: payload.sub,
      username: payload.preferred_username || payload.username || payload.email || payload.sub,
      role,  // Extract role for resolver compatibility
      roles,
      realm_access: { roles },
      resource_access: payload.resource_access,
    };
  }
}
