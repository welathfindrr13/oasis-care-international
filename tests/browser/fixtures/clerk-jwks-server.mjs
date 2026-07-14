import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const host = process.env.CLERK_FIXTURE_HOST || "127.0.0.1";
const port = Number(process.env.CLERK_FIXTURE_PORT || 4011);
const issuer = process.env.CLERK_FIXTURE_ISSUER || `http://${host}:${port}`;
const audience = process.env.CLERK_FIXTURE_AUDIENCE || "oasis-browser-proof";
const authorizedParty =
  process.env.CLERK_FIXTURE_AUTHORIZED_PARTY || "http://localhost:3004";
const keyId = `oasis-browser-${randomUUID()}`;
const profiles = Object.freeze({
  manager: {
    claims: { sub: "user_clerk_manager_browser", org_role: "org:admin" },
  },
  carer: {
    claims: { sub: "user_clerk_carer_browser", org_role: "org:admin" },
  },
  family: {
    claims: { sub: "user_clerk_family_browser", org_role: "org:member" },
  },
  invalid_signature: {
    claims: { sub: "user_clerk_manager_browser", org_role: "org:admin" },
    invalidSignature: true,
  },
  invalid_issuer: {
    claims: { sub: "user_clerk_manager_browser", org_role: "org:admin" },
    overrides: { iss: "http://127.0.0.1:4011/not-the-clerk-issuer" },
  },
  invalid_audience: {
    claims: { sub: "user_clerk_manager_browser", org_role: "org:admin" },
    overrides: { aud: "not-oasis-browser-proof" },
  },
  invalid_authorized_party: {
    claims: { sub: "user_clerk_manager_browser", org_role: "org:admin" },
    overrides: { azp: "http://untrusted.example.test" },
  },
  expired: {
    claims: { sub: "user_clerk_manager_browser", org_role: "org:admin" },
    timeOffsetSeconds: -1_200,
  },
});

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const { privateKey: untrustedPrivateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  alg: "RS256",
  kid: keyId,
  use: "sig",
};

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function tokenFor(profile) {
  const now =
    Math.floor(Date.now() / 1000) + Number(profile.timeOffsetSeconds || 0);
  const header = encode({ alg: "RS256", kid: keyId, typ: "JWT" });
  const payload = encode({
    ...profile.claims,
    iss: issuer,
    aud: audience,
    azp: authorizedParty,
    org_id: "org_clerk_browser_primary",
    iat: now,
    nbf: now - 5,
    exp: now + 600,
    ...profile.overrides,
  });
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(
    profile.invalidSignature ? untrustedPrivateKey : privateKey,
    "base64url",
  )}`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", issuer);
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ready: true }));
    return;
  }
  if (request.method === "GET" && url.pathname === "/.well-known/jwks.json") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ keys: [jwk] }));
    return;
  }
  const match =
    request.method === "GET" && url.pathname.match(/^\/tokens\/([a-z_]+)$/);
  const profile = match ? profiles[match[1]] : null;
  if (profile) {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ token: tokenFor(profile) }));
    return;
  }
  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "Fixture profile not found" }));
});

server.listen(port, host, () => {
  process.stdout.write(`Clerk browser JWKS fixture listening at ${issuer}\n`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
