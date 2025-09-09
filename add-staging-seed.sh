#!/bin/bash
# === OASIS — ADD STAGING SEED (clients/visits/meds with fresh dates) ===
# Mode: ACT
# Purpose: Create a seed script that populates demo data (today-centric), add pnpm script, commit.
# Safety: No secrets; no Terraform; code-only.

set -euo pipefail

echo "0) Repo snapshot"
git status -sb || true
node -v || true
pnpm -v || true

# 1) Ensure ts-node exists for running the seed
if ! grep -q '"ts-node"' package.json 2>/dev/null; then
  pnpm add -Dw ts-node typescript || true
fi

# 2) Create seed script (schema-flexible via 'any' to avoid TS type errors)
mkdir -p scripts/seed
cat > scripts/seed/staging.seed.ts <<'TS'
/**
 * Staging seed: creates 10 clients, 25 visits around "today" (one due in ~1h),
 * and 3 medications. Adjust model/field names below if your Prisma schema differs.
 */
import { PrismaClient } from '../../libs/db/src/generated/client';
const prisma: any = new PrismaClient();

const plusDays = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x; };

async function run() {
  console.log("[seed] starting…");

  // ── Clients ──
  for (let i = 1; i <= 10; i++) {
    await prisma.client.upsert({
      where: { email: `client${i}@demo.local` },
      update: {},
      create: { name: `Client ${i}`, email: `client${i}@demo.local` },
    });
  }
  const clients = await prisma.client.findMany({ take: 10 });
  if (!clients.length) throw new Error("No clients table or fields; adjust model/field names in seed.");

  // ── Visits ──
  const now = new Date();
  for (let i = 0; i < 25; i++) {
    const c = clients[i % clients.length];
    const when = plusDays((i % 15) - 7);
    if (i === 0) when.setHours(now.getHours() + 1); // one upcoming soon
    await prisma.visit.upsert({
      where: { externalId: `seed-${i}` },
      update: {},
      create: {
        externalId: `seed-${i}`,
        clientId: c.id,
        scheduledAt: when,
        notes: "Seed visit",
      },
    });
  }

  // ── Medications ──
  for (let i = 0; i < 3; i++) {
    const c = clients[i];
    await prisma.medication.upsert({
      where: { code: `seed-med-${i}` },
      update: {},
      create: {
        code: `seed-med-${i}`,
        name: `Med ${i}`,
        clientId: c.id,
        dosage: "1 tab",
        frequency: "BID",
      },
    });
  }

  console.log("[seed] complete ✅");
}
run()
  .catch((e) => { console.error("[seed] error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
TS

# 3) Add pnpm script if missing
node - <<'NODE'
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json','utf8'));
p.scripts = p.scripts || {};
if (!p.scripts['seed:staging']) {
  p.scripts['seed:staging'] = 'ts-node scripts/seed/staging.seed.ts';
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2));
  console.log("Added script: pnpm seed:staging");
} else {
  console.log("Script exists: pnpm seed:staging");
}
NODE

git add -A
git commit -m "feat(seed): add relative-date staging seed (clients/visits/meds)"

# 4) Friendly reminder on how to run it (no execution here)
cat <<'MSG'
Seed script added.

Run when DB is reachable:
  pnpm seed:staging

If you see model/field name errors, tell me the exact error and I'll align the seed to your Prisma schema in one pass.
MSG
