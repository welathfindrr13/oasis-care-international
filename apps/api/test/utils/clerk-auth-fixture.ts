import * as jwt from "jsonwebtoken";
import { getTestJwtSecret } from "../jwt.mock";

export const CLERK_TEST_ISSUER = "https://synthetic-clerk.oasis.test";
export const CLERK_TEST_AUDIENCE = "oasis-api-test";
export const CLERK_TEST_AUTHORIZED_PARTY = "https://app.oasis.test";

export function configureSyntheticClerkAuth(): void {
  process.env.NODE_ENV = "test";
  process.env.AUTH_IDENTITY_PROVIDER = "clerk";
  process.env.JWT_SECRET = getTestJwtSecret();
  process.env.CLERK_ISSUER = CLERK_TEST_ISSUER;
  process.env.CLERK_AUDIENCE = CLERK_TEST_AUDIENCE;
  process.env.CLERK_AUTHORIZED_PARTIES = CLERK_TEST_AUTHORIZED_PARTY;
  process.env.TENANT_MEMBERSHIP_REQUIRED = "true";
}

export function syntheticClerkBearer({
  subject,
  externalOrganizationId,
  organizationRole = "org:member",
}: {
  subject: string;
  externalOrganizationId: string;
  organizationRole?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      sub: subject,
      iss: CLERK_TEST_ISSUER,
      aud: CLERK_TEST_AUDIENCE,
      azp: CLERK_TEST_AUTHORIZED_PARTY,
      org_id: externalOrganizationId,
      org_role: organizationRole,
      iat: now,
      exp: now + 60 * 60,
    },
    getTestJwtSecret(),
    { algorithm: "HS256" },
  );

  return `Bearer ${token}`;
}
