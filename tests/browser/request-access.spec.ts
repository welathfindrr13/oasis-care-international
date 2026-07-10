import { expect, test } from "playwright/test";
import { PrismaClient } from "../../libs/db/src/generated/client/index.js";

const prisma = new PrismaClient();
const email = `browser-company-${Date.now()}@example.test`;

test.afterAll(async () => {
  const requests = await prisma.companyAccessRequest.findMany({
    where: { normalized_business_email: email },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: { resource_id: { in: requests.map((request) => request.id) } },
  });
  await prisma.companyAccessRequest.deleteMany({
    where: { normalized_business_email: email },
  });
  await prisma.$disconnect();
});

async function submit(page: import("playwright/test").Page) {
  await page.goto("/request-access");
  await page.getByLabel("Care company name").fill("Browser Synthetic Care");
  await page.getByLabel("Contact name").fill("Browser Synthetic Contact");
  await page.getByLabel("Business email").fill(email);
  await page
    .getByLabel("Operational note")
    .fill("Synthetic browser canary only");
  await page.getByRole("button", { name: "Request Oasis access" }).click();
  await expect(
    page.getByRole("heading", { name: "Request received" }),
  ).toBeVisible();
  await expect(page.getByText("If your request is eligible")).toBeVisible();
}

test("public request remains pending and non-enumerating across duplicates", async ({
  page,
}) => {
  await submit(page);
  const firstConfirmation = await page.getByRole("status").innerText();

  await submit(page);
  const duplicateConfirmation = await page.getByRole("status").innerText();
  expect(duplicateConfirmation).toBe(firstConfirmation);

  const requests = await prisma.companyAccessRequest.findMany({
    where: { normalized_business_email: email },
  });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    status: "PENDING_APPROVAL",
    organization_id: null,
    phone: null,
  });
  expect(
    await prisma.organizationMembershipInvitation.count({
      where: { source_request_id: requests[0].id },
    }),
  ).toBe(0);
  expect(
    await prisma.organizationProvisioningOutbox.count({
      where: { source_request_id: requests[0].id },
    }),
  ).toBe(0);
  expect(
    await prisma.organizationMembership.count({
      where: { normalized_email: email },
    }),
  ).toBe(0);
});
