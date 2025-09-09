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
