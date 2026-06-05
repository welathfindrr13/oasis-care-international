import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import jwksClient, { JwksClient, SigningKey } from 'jwks-rsa';
import { getLocalAuthIssuer, isLocalAuthEnabledEnv } from './local-dev-auth';

export interface JwtPayload {
  sub: string;
  iss?: string;
  aud?: string | string[];
  azp?: string;
  client_id?: string;
  token_use?: string;
  preferred_username?: string;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
  'custom:organization_id'?: string;
  organization_id?: string;
  organization_role?: string;
  org_id?: string;
  org_role?: string;
  org_slug?: string;
  tenant_id?: string;
  role?: string;
  roles?: string[];
  email?: string;
  public_metadata?: Record<string, unknown>;
  unsafe_metadata?: Record<string, unknown>;
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
    const provider = JwtStrategy.getIdentityProvider();
    const isLocalDevToken =
      JwtStrategy.isLocalAuthEnabled() && payload.iss === JwtStrategy.getLocalAuthIssuer();

    if (provider === 'clerk' && !isLocalDevToken) {
      JwtStrategy.validateClerkClaims(payload);
    } else {
      // Accept both Cognito ID tokens (aud) and access tokens (client_id).
      const expectedClientId = process.env.COGNITO_CLIENT_ID;
      if (expectedClientId && !isLocalDevToken) {
        const tokenAudience = payload.aud;
        const tokenClientId = payload.client_id;
        if (tokenAudience !== expectedClientId && tokenClientId !== expectedClientId) {
          throw new Error('Token does not match configured Cognito client');
        }
      }
    }

    const rawRoles = JwtStrategy.extractRawRoles(payload, provider);
    const canonicalRole = JwtStrategy.resolveCanonicalRole(rawRoles, provider);
    const normalizedRoles = rawRoles
      .map((role) => JwtStrategy.normalizeRoleValue(role))
      .filter(Boolean);

    const allRoles = Array.from(new Set([canonicalRole, ...normalizedRoles]));
    const organizationId = JwtStrategy.extractOrganizationClaim(payload, provider);

    return {
      id: payload.sub,
      sub: payload.sub,
      username: payload['cognito:username'] || payload.preferred_username,
      email: payload.email,
      organizationId: organizationId || null,
      authProvider: isLocalDevToken ? 'local' : provider,
      authMode: isLocalDevToken ? 'local-dev' : provider,
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

    const provider = JwtStrategy.getIdentityProvider();
    if (provider === 'clerk') {
      return JwtStrategy.buildClerkStrategyOptions(jwksTimeoutMs);
    }

    const cognitoIssuer = process.env.COGNITO_ISSUER;
    const cognitoClientId = process.env.COGNITO_CLIENT_ID;
    if (!cognitoIssuer) {
      throw new Error('COGNITO_ISSUER is required when AUTH_IDENTITY_PROVIDER is cognito');
    }
    if (!cognitoClientId) {
      throw new Error('COGNITO_CLIENT_ID is required when AUTH_IDENTITY_PROVIDER is cognito');
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

  private static getIdentityProvider(): string {
    return (process.env.AUTH_IDENTITY_PROVIDER || 'cognito').trim().toLowerCase();
  }

  private static buildClerkStrategyOptions(jwksTimeoutMs: number): StrategyOptions {
    const issuer = (process.env.CLERK_ISSUER || '').trim();
    if (!issuer) {
      throw new Error('CLERK_ISSUER is required when AUTH_IDENTITY_PROVIDER=clerk');
    }

    const jwksUri = (process.env.CLERK_JWKS_URL || `${issuer}/.well-known/jwks.json`).trim();
    const client = jwksClient({
      jwksUri,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      timeout: Number.isFinite(jwksTimeoutMs) ? jwksTimeoutMs : 5000,
    });

    return {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer,
      secretOrKeyProvider: (_request, rawJwtToken, done) =>
        JwtStrategy.resolveJwksSigningKey(client, rawJwtToken, jwksTimeoutMs, done),
    };
  }

  private static resolveJwksSigningKey(
    client: JwksClient,
    rawJwtToken: unknown,
    jwksTimeoutMs: number,
    done: (err: Error | null, key?: string) => void,
  ) {
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
  }

  private static validateClerkClaims(payload: JwtPayload): void {
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Clerk token is missing subject');
    }

    const issuer = (process.env.CLERK_ISSUER || '').trim();
    if (issuer && payload.iss !== issuer) {
      throw new Error('Clerk token issuer is invalid');
    }

    const configuredAudience = (process.env.CLERK_AUDIENCE || '').trim();
    if (configuredAudience) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud].filter(Boolean);
      if (!audiences.includes(configuredAudience)) {
        throw new Error('Clerk token audience is invalid');
      }
    }

    const configuredParties = (process.env.CLERK_AUTHORIZED_PARTIES || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (configuredParties.length > 0 && !configuredParties.includes(String(payload.azp || ''))) {
      throw new Error('Clerk token authorized party is invalid');
    }

    if (!JwtStrategy.extractOrganizationClaim(payload, 'clerk')) {
      throw new Error('Clerk token is missing organization claim');
    }

    JwtStrategy.resolveCanonicalRole(JwtStrategy.extractRawRoles(payload, 'clerk'), 'clerk');
  }

  private static extractOrganizationClaim(payload: JwtPayload, provider: string): string | null {
    const candidates =
      provider === 'clerk'
        ? [payload.org_id, payload.organization_id, payload['custom:organization_id'], payload.tenant_id]
        : [payload['custom:organization_id'], payload.organization_id, payload.org_id, payload.tenant_id];

    return candidates
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value.length > 0) || null;
  }

  private static extractRawRoles(payload: JwtPayload, provider: string): string[] {
    if (provider === 'clerk') {
      const metadataRole = JwtStrategy.valueFromMetadata(payload.public_metadata, 'role')
        || JwtStrategy.valueFromMetadata(payload.unsafe_metadata, 'role');
      return [
        payload.org_role,
        payload.organization_role,
        payload.role,
        metadataRole,
        ...(Array.isArray(payload.roles) ? payload.roles : []),
      ]
        .filter(Boolean)
        .map((role) => String(role));
    }

    return [
      ...(payload['cognito:groups'] || []),
      ...(payload.realm_access?.roles || []),
      payload.role,
      ...(Array.isArray(payload.roles) ? payload.roles : []),
    ]
      .filter(Boolean)
      .map((role) => String(role));
  }

  private static valueFromMetadata(metadata: Record<string, unknown> | undefined, key: string): string | null {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private static resolveCanonicalRole(rawRoles: string[], provider: string): string {
    const normalizedRoles = rawRoles
      .map((role) => JwtStrategy.normalizeRoleValue(role))
      .filter(Boolean);

    const hasAny = (candidates: string[]) =>
      candidates.some((candidate) => normalizedRoles.includes(candidate));

    if (hasAny(['admin', 'org:admin'])) return 'admin';
    if (hasAny(['manager', 'org:manager'])) return 'admin';
    if (hasAny(['carer', 'care_manager', 'staff', 'office', 'org:member', 'org:staff', 'org:carer'])) {
      return 'carer';
    }
    if (hasAny(['family', 'user', 'viewer', 'org:family', 'org:user', 'org:viewer'])) {
      return 'user';
    }

    if (provider === 'clerk') {
      throw new Error('Clerk token role is missing or unsupported');
    }

    return 'user';
  }

  private static normalizeRoleValue(role: string): string {
    return String(role || '')
      .trim()
      .toLowerCase()
      .replace(/^role:/, '')
      .replace(/\s+/g, '_');
  }
}
