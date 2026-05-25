import crypto from 'node:crypto';

import { normalizeAppRoles } from './roles';

export interface LocalAuthProfileInput {
  email?: string;
  name?: string;
  organizationId?: string;
  role?: string;
}

export interface LocalAuthSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  organizationId: string | null;
  accessToken: string;
  idToken: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function requireLocalAuthSecret(): string {
  const value = (process.env.LOCAL_AUTH_JWT_SECRET || process.env.JWT_SECRET || '').trim();
  if (!value) {
    throw new Error('LOCAL_AUTH_JWT_SECRET or JWT_SECRET is required when local auth is enabled');
  }
  return value;
}

function getLocalAuthIssuer(): string {
  return (process.env.LOCAL_AUTH_ISSUER || 'oasis-local-dev').trim() || 'oasis-local-dev';
}

export function createLocalAccessToken(input: LocalAuthProfileInput): string {
  const now = Math.floor(Date.now() / 1000);
  const issuer = getLocalAuthIssuer();
  const roles = normalizeAppRoles([input.role || 'admin']);
  const canonicalRole = roles[0] || 'admin';
  const email = (input.email || `${canonicalRole}@local.dev`).trim().toLowerCase();
  const name = (input.name || `Local ${canonicalRole}`).trim();
  const subjectSeed = `${canonicalRole}:${email}:${input.organizationId || 'auto'}`;
  const subject = `local-${crypto.createHash('sha256').update(subjectSeed).digest('hex').slice(0, 16)}`;

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    sub: subject,
    iss: issuer,
    aud: issuer,
    exp: now + 8 * 60 * 60,
    iat: now,
    email,
    preferred_username: name,
    role: canonicalRole,
    realm_access: {
      roles,
    },
    organization_id: (input.organizationId || '').trim() || undefined,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', requireLocalAuthSecret())
    .update(content)
    .digest();

  return `${content}.${base64url(signature)}`;
}

export function createLocalSessionUser(input: LocalAuthProfileInput): LocalAuthSessionUser {
  const roles = normalizeAppRoles([input.role || 'admin']);
  const canonicalRole = roles[0] || 'admin';
  const email = (input.email || `${canonicalRole}@local.dev`).trim().toLowerCase();
  const name = (input.name || `Local ${canonicalRole}`).trim();
  const accessToken = createLocalAccessToken({
    ...input,
    email,
    name,
    role: canonicalRole,
  });

  return {
    id: email,
    email,
    name,
    role: canonicalRole,
    roles,
    organizationId: (input.organizationId || '').trim() || null,
    accessToken,
    idToken: accessToken,
  };
}
