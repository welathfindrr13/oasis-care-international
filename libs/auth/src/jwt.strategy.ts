import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import jwksClient, { SigningKey } from 'jwks-rsa';
import { getLocalAuthIssuer, isLocalAuthEnabledEnv } from './local-dev-auth';

export interface JwtPayload {
  sub: string;
  iss?: string;
  aud?: string;
  client_id?: string;
  token_use?: string;
  preferred_username?: string;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
  'custom:organization_id'?: string;
  organization_id?: string;
  org_id?: string;
  tenant_id?: string;
  email?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };
  exp: number;
  iat: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super(JwtStrategy.buildStrategyOptions());
  }

  async validate(payload: JwtPayload): Promise<any> {
    // Accept both Cognito ID tokens (aud) and access tokens (client_id).
    const expectedClientId = process.env.COGNITO_CLIENT_ID;
    const isLocalDevToken =
      JwtStrategy.isLocalAuthEnabled() && payload.iss === JwtStrategy.getLocalAuthIssuer();
    if (expectedClientId && !isLocalDevToken) {
      const tokenAudience = payload.aud;
      const tokenClientId = payload.client_id;
      if (tokenAudience !== expectedClientId && tokenClientId !== expectedClientId) {
        throw new Error('Token does not match configured Cognito client');
      }
    }

    // Support both Cognito token structure and legacy Keycloak structure.
    // IMPORTANT: We canonicalize to app roles (`admin`/`carer`) because many guards
    // and services assume those exact strings.
    const cognitoGroups = payload['cognito:groups'] || [];
    const realmRoles = payload.realm_access?.roles || [];

    const rawRoles = [...cognitoGroups, ...realmRoles]
      .filter(Boolean)
      .map((r) => String(r).trim())
      .filter(Boolean);

    const normalizedRoles = rawRoles.map((r) =>
      r
        .toLowerCase()
        // Convert UI-ish roles like "Care Manager" into "care_manager"
        .replace(/\s+/g, '_')
    );

    const hasAny = (candidates: string[]) =>
      candidates.some((c) => normalizedRoles.includes(c));

    // Canonical mapping (per product decision): only `admin` and `carer` are used for RBAC.
    // Treat other staff-ish roles as `carer` (clinical staff) to avoid "Invalid role" failures.
    const canonicalRole = hasAny(['admin']) ? 'admin' : hasAny(['carer', 'care_manager', 'manager', 'office']) ? 'carer' : 'user';

    // Preserve canonical role first so `roles[0]` is stable and predictable.
    const allRoles = Array.from(new Set([canonicalRole, ...normalizedRoles]));
    
    const tokenOrganizationId = [
      payload['custom:organization_id'],
      payload.organization_id,
      payload.org_id,
      payload.tenant_id,
    ]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value.length > 0);

    const organizationId = tokenOrganizationId;

    return {
      id: payload.sub,
      sub: payload.sub,
      username: payload['cognito:username'] || payload.preferred_username,
      email: payload.email,
      organizationId: organizationId || null,
      authMode: isLocalDevToken ? 'local-dev' : 'cognito',
      role: canonicalRole,
      realm_access: {
        roles: allRoles.length > 0 ? allRoles : ['user'],
      },
      resource_access: payload.resource_access,
    };
  }

  private static buildStrategyOptions(): StrategyOptions {
    const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
    const isTest = nodeEnv === 'test';
    const parsedJwksTimeoutMs = Number(process.env.JWT_JWKS_TIMEOUT_MS || 5000);
    const jwksTimeoutMs =
      Number.isFinite(parsedJwksTimeoutMs) && parsedJwksTimeoutMs > 0
        ? parsedJwksTimeoutMs
        : 5000;

    if (isTest) {
      return {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: process.env.JWT_SECRET || 'test-secret-key-for-oasis-testing-only',
      };
    }

    if (JwtStrategy.isLocalAuthEnabled()) {
      if (nodeEnv === 'staging' || nodeEnv === 'production') {
        throw new Error('LOCAL_AUTH_ENABLED/DEV_AUTH_ENABLED is not allowed in staging or production');
      }

      const localSecret = (
        process.env.LOCAL_AUTH_JWT_SECRET ||
        process.env.JWT_SECRET ||
        ''
      ).trim();
      if (!localSecret) {
        throw new Error('LOCAL_AUTH_JWT_SECRET or JWT_SECRET is required when local auth is enabled');
      }

      return {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        algorithms: ['HS256'],
        issuer: JwtStrategy.getLocalAuthIssuer(),
        secretOrKey: localSecret,
      };
    }

    const cognitoIssuer = process.env.COGNITO_ISSUER;
    const cognitoClientId = process.env.COGNITO_CLIENT_ID;
    if (!cognitoIssuer) {
      throw new Error('COGNITO_ISSUER is required when NODE_ENV is not test');
    }
    if (!cognitoClientId) {
      throw new Error('COGNITO_CLIENT_ID is required when NODE_ENV is not test');
    }

    const client = jwksClient({
      jwksUri: `${cognitoIssuer}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      timeout: Number.isFinite(jwksTimeoutMs) ? jwksTimeoutMs : 5000,
    });

    return {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer: cognitoIssuer,
      secretOrKeyProvider: (_request, rawJwtToken, done) => {
        if (typeof rawJwtToken !== 'string' || rawJwtToken.trim().length === 0) {
          return done(new Error('Missing token'), undefined);
        }

        let completed = false;
        const finish = (err: Error | null, key?: string) => {
          if (completed) return;
          completed = true;
          done(err, key);
        };

        const timeoutHandle = setTimeout(() => {
          finish(new Error(`JWKS lookup timed out after ${jwksTimeoutMs}ms`), undefined);
        }, jwksTimeoutMs + 250);

        const tokenParts = rawJwtToken.split('.');
        if (tokenParts.length !== 3) {
          clearTimeout(timeoutHandle);
          return finish(new Error('Invalid token'), undefined);
        }

        try {
          const headerSegment = tokenParts[0].replace(/-/g, '+').replace(/_/g, '/');
          const header = JSON.parse(Buffer.from(headerSegment, 'base64').toString('utf8'));
          const kid = typeof header?.kid === 'string' ? header.kid.trim() : '';
          if (!kid) {
            clearTimeout(timeoutHandle);
            return finish(new Error('Token missing kid header'), undefined);
          }

          client.getSigningKey(kid, (err: Error | null, key?: SigningKey) => {
            clearTimeout(timeoutHandle);
            if (err) {
              return finish(err, undefined);
            }
            const signingKey = key?.getPublicKey();
            if (!signingKey) {
              return finish(new Error('Unable to resolve JWT signing key'), undefined);
            }
            finish(null, signingKey);
          });
        } catch (e) {
          clearTimeout(timeoutHandle);
          finish(e as Error, undefined);
        }
      },
    };
  }

  private static isLocalAuthEnabled(): boolean {
    return isLocalAuthEnabledEnv(process.env);
  }

  private static getLocalAuthIssuer(): string {
    return getLocalAuthIssuer(process.env);
  }
}
