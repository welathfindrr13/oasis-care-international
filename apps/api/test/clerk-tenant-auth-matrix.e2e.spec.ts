import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "@oasis/auth";
import { PrismaService, VisitStatus } from "@oasis/db";
import { ClsModule } from "nestjs-cls";
import request from "supertest";
import { StartedTestContainer } from "testcontainers";
import { AiSummaryRepository } from "../src/ai-summary/ai-summary.repository";
import { AiSummaryResolver } from "../src/ai-summary/ai-summary.resolver";
import { AiSummaryService } from "../src/ai-summary/ai-summary.service";
import { AuthAccessModule } from "../src/auth/auth-access.module";
import { CarebridgeAccessService } from "../src/carebridge/access/carebridge-access.service";
import { CarebridgeRepository } from "../src/carebridge/carebridge.repository";
import { CarebridgeResolver } from "../src/carebridge/carebridge.resolver";
import { CarebridgeService } from "../src/carebridge/carebridge.service";
import { FamilyInvitationService } from "../src/carebridge/family-invitation.service";
import { CareLogService } from "../src/care-log/care-log.service";
import { MedicationRepository } from "../src/medication/medication.repository";
import { VisitCompletionProofKeyring } from "../src/visit/visit-completion-proof-keyring";
import { VisitRepository } from "../src/visit/visit.repository";
import { VisitResolver } from "../src/visit/visit.resolver";
import { VisitService } from "../src/visit/visit.service";
import { getTestJwtSecret } from "./jwt.mock";
import {
  configureSyntheticClerkAuth,
  syntheticClerkBearer,
} from "./utils/clerk-auth-fixture";
import { startPostgres } from "./utils/test-container";

describe("synthetic Clerk tenant and authorization matrix", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;

  const organizationId = "clerk-matrix-organization";
  const externalOrganizationId = "org_clerk_matrix";
  const otherOrganizationId = "clerk-matrix-other-organization";
  const otherExternalOrganizationId = "org_clerk_matrix_other";

  const managerSubject = "user_clerk_matrix_manager";
  const carerSubject = "user_clerk_matrix_carer";
  const otherCarerSubject = "user_clerk_matrix_other_carer";
  const familySubject = "user_clerk_matrix_family";

  const assignedCarerId = "10000000-0000-4000-8000-000000000001";
  const otherCarerId = "10000000-0000-4000-8000-000000000002";
  const crossOrganizationCarerId = "10000000-0000-4000-8000-000000000003";
  const clientId = "20000000-0000-4000-8000-000000000001";
  const otherClientId = "20000000-0000-4000-8000-000000000002";
  const assignedVisitId = "30000000-0000-4000-8000-000000000001";
  const unassignedVisitId = "30000000-0000-4000-8000-000000000002";
  const crossOrganizationVisitId = "30000000-0000-4000-8000-000000000003";
  const familyVisitId = "30000000-0000-4000-8000-000000000004";
  const crossOrganizationFamilyVisitId = "30000000-0000-4000-8000-000000000005";
  const ownSummaryId = "40000000-0000-4000-8000-000000000001";
  const otherSummaryId = "40000000-0000-4000-8000-000000000002";
  const familyMembershipId = "50000000-0000-4000-8000-000000000001";
  const familyInvitationId = "60000000-0000-4000-8000-000000000001";
  const familyContactId = "70000000-0000-4000-8000-000000000001";
  const familyCareRoomId = "80000000-0000-4000-8000-000000000001";
  const crossOrganizationCareRoomId = "80000000-0000-4000-8000-000000000002";
  const familyCareRoomMembershipId = "90000000-0000-4000-8000-000000000001";
  const familyStoryId = "a0000000-0000-4000-8000-000000000001";
  const crossOrganizationFamilyStoryId = "a0000000-0000-4000-8000-000000000002";

  beforeAll(async () => {
    const started = await startPostgres();
    container = started.container;
    process.env.DATABASE_URL = started.dbUrl;
    configureSyntheticClerkAuth();
    process.env.VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID = "test-v1";
    process.env.VISIT_COMPLETION_PROOF_ACTIVE_SECRET =
      "visit-completion-proof-test-secret-32-bytes-minimum";

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            setup: (cls) => cls.set("requestId", "clerk-auth-matrix"),
          },
        }),
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.register({ secret: getTestJwtSecret() }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          playground: false,
          context: ({ req }: any) => ({ req }),
        }),
        AuthAccessModule,
      ],
      providers: [
        JwtStrategy,
        AiSummaryResolver,
        AiSummaryService,
        AiSummaryRepository,
        CarebridgeResolver,
        CarebridgeService,
        CarebridgeRepository,
        CarebridgeAccessService,
        MedicationRepository,
        VisitResolver,
        VisitService,
        VisitRepository,
        VisitCompletionProofKeyring,
        // Care-note creation is unrelated to the startVisit authorization path.
        { provide: CareLogService, useValue: { createCareLog: jest.fn() } },
        // Family invitation writes are outside this matrix; family-safe reads
        // and concern writes use the real CareBridge resolver/service/repository.
        { provide: FamilyInvitationService, useValue: {} },
        // Metrics are inert collaborators; repository and service behavior stays real.
        { provide: "visit_overlap_total", useValue: { inc: jest.fn() } },
        { provide: "visits_created_total", useValue: { inc: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanMatrixData();
    await seedMatrixData();
  });

  function bearer(
    subject: string,
    tokenOrganizationId = externalOrganizationId,
    organizationRole = "org:member",
  ): string {
    return syntheticClerkBearer({
      subject,
      externalOrganizationId: tokenOrganizationId,
      organizationRole,
    });
  }

  function graphql(
    token: string,
    query: string,
    variables?: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", token)
      .send({ query, variables });
  }

  async function cleanMatrixData(): Promise<void> {
    await prisma.auditLog.deleteMany();
    await prisma.concernMessage.deleteMany();
    await prisma.concernEvent.deleteMany();
    await prisma.concern.deleteMany();
    await prisma.verifiedVisitStory.deleteMany();
    await prisma.accessGrant.deleteMany();
    await prisma.careRoomMembership.deleteMany();
    await prisma.familyContact.deleteMany();
    await prisma.careRoom.deleteMany();
    await prisma.healthSummary.deleteMany();
    await prisma.visitTask.deleteMany();
    await prisma.visit.deleteMany();
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.client.deleteMany();
    await prisma.carer.deleteMany();
    await prisma.organization.deleteMany();
  }

  async function seedMatrixData(): Promise<void> {
    await prisma.organization.createMany({
      data: [
        { id: organizationId, name: "Synthetic Clerk Matrix" },
        { id: otherOrganizationId, name: "Synthetic Clerk Matrix Other" },
      ],
    });
    await prisma.carer.createMany({
      data: [
        {
          id: assignedCarerId,
          organization_id: organizationId,
          first_name: "Assigned",
          last_name: "Carer",
          email: "assigned.clerk.matrix@example.test",
        },
        {
          id: otherCarerId,
          organization_id: organizationId,
          first_name: "Other",
          last_name: "Carer",
          email: "other.clerk.matrix@example.test",
        },
        {
          id: crossOrganizationCarerId,
          organization_id: otherOrganizationId,
          first_name: "Cross tenant",
          last_name: "Carer",
          email: "cross-tenant.clerk.matrix@example.test",
        },
      ],
    });
    await prisma.client.createMany({
      data: [
        {
          id: clientId,
          organization_id: organizationId,
          full_name: "Own tenant client",
          address_line1: "1 Test Street",
          city: "Leeds",
          postcode: "LS1 1AA",
        },
        {
          id: otherClientId,
          organization_id: otherOrganizationId,
          full_name: "Other tenant client",
          address_line1: "2 Test Street",
          city: "Leeds",
          postcode: "LS1 1AB",
        },
      ],
    });
    await prisma.visit.createMany({
      data: [
        {
          id: assignedVisitId,
          organization_id: organizationId,
          carer_id: assignedCarerId,
          client_id: clientId,
          scheduled_start: new Date("2026-07-13T09:00:00.000Z"),
          scheduled_end: new Date("2026-07-13T10:00:00.000Z"),
          status: VisitStatus.SCHEDULED,
        },
        {
          id: unassignedVisitId,
          organization_id: organizationId,
          carer_id: otherCarerId,
          client_id: clientId,
          scheduled_start: new Date("2026-07-13T10:00:00.000Z"),
          scheduled_end: new Date("2026-07-13T11:00:00.000Z"),
          status: VisitStatus.SCHEDULED,
        },
        {
          id: crossOrganizationVisitId,
          organization_id: otherOrganizationId,
          carer_id: crossOrganizationCarerId,
          client_id: otherClientId,
          scheduled_start: new Date("2026-07-13T09:00:00.000Z"),
          scheduled_end: new Date("2026-07-13T10:00:00.000Z"),
          status: VisitStatus.SCHEDULED,
        },
        {
          id: familyVisitId,
          organization_id: organizationId,
          carer_id: assignedCarerId,
          client_id: clientId,
          scheduled_start: new Date("2026-07-12T09:00:00.000Z"),
          scheduled_end: new Date("2026-07-12T10:00:00.000Z"),
          actual_start: new Date("2026-07-12T09:02:00.000Z"),
          actual_end: new Date("2026-07-12T09:58:00.000Z"),
          status: VisitStatus.COMPLETED,
          notes: "Private own-tenant care narrative",
        },
        {
          id: crossOrganizationFamilyVisitId,
          organization_id: otherOrganizationId,
          carer_id: crossOrganizationCarerId,
          client_id: otherClientId,
          scheduled_start: new Date("2026-07-12T09:00:00.000Z"),
          scheduled_end: new Date("2026-07-12T10:00:00.000Z"),
          actual_start: new Date("2026-07-12T09:01:00.000Z"),
          actual_end: new Date("2026-07-12T09:59:00.000Z"),
          status: VisitStatus.COMPLETED,
          notes: "Cross-tenant private care narrative",
        },
      ],
    });
    await prisma.healthSummary.createMany({
      data: [
        {
          id: ownSummaryId,
          client_id: clientId,
          period_start: new Date("2026-07-06T00:00:00.000Z"),
          period_end: new Date("2026-07-12T00:00:00.000Z"),
          summary_json: { overview: "own tenant summary" },
          risk_levels: { overall: "green" },
          generated_at: new Date("2026-07-13T08:00:00.000Z"),
          expires_at: new Date("2099-01-01T00:00:00.000Z"),
        },
        {
          id: otherSummaryId,
          client_id: otherClientId,
          period_start: new Date("2026-07-06T00:00:00.000Z"),
          period_end: new Date("2026-07-12T00:00:00.000Z"),
          summary_json: { overview: "other tenant summary" },
          risk_levels: { overall: "green" },
          generated_at: new Date("2026-07-13T08:00:00.000Z"),
          expires_at: new Date("2099-01-01T00:00:00.000Z"),
        },
      ],
    });
    await prisma.$transaction([
      prisma.organizationMembership.create({
        data: {
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: managerSubject,
          normalized_email: "manager.clerk.matrix@example.test",
          role: "manager",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_clerk_matrix_manager",
        },
      }),
      prisma.organizationMembership.create({
        data: {
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: carerSubject,
          normalized_email: "assigned.clerk.matrix@example.test",
          role: "carer",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_clerk_matrix_carer",
          carer_id: assignedCarerId,
        },
      }),
      prisma.organizationMembership.create({
        data: {
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: otherCarerSubject,
          normalized_email: "other.clerk.matrix@example.test",
          role: "carer",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_clerk_matrix_other_carer",
          carer_id: otherCarerId,
        },
      }),
      prisma.organizationMembership.create({
        data: {
          id: familyMembershipId,
          organization_id: organizationId,
          identity_provider: "clerk",
          auth_subject: familySubject,
          normalized_email: "family.clerk.matrix@example.test",
          role: "family",
          status: "ACTIVE",
          external_organization_id: externalOrganizationId,
          external_membership_id: "orgmem_clerk_matrix_family",
        },
      }),
    ]);

    await prisma.organizationMembershipInvitation.create({
      data: {
        id: familyInvitationId,
        organization_id: organizationId,
        activated_membership_id: familyMembershipId,
        identity_provider: "clerk",
        intended_email: "family.clerk.matrix@example.test",
        normalized_email: "family.clerk.matrix@example.test",
        intended_role: "family",
        status: "ACCEPTED",
        external_invitation_id: "clerk_invitation_matrix_family",
        bound_auth_subject: familySubject,
        expires_at: new Date("2099-07-20T00:00:00.000Z"),
        accepted_at: new Date("2026-07-12T08:00:00.000Z"),
      },
    });
    await prisma.familyContact.create({
      data: {
        id: familyContactId,
        organization_id: organizationId,
        auth_subject: familySubject,
        identity_type: "clerk",
        email: "family.clerk.matrix@example.test",
        full_name: "Synthetic Clerk Family",
        relationship: "Relative",
      },
    });
    await prisma.careRoom.createMany({
      data: [
        {
          id: familyCareRoomId,
          organization_id: organizationId,
          client_id: clientId,
          status: "ACTIVE",
        },
        {
          id: crossOrganizationCareRoomId,
          organization_id: otherOrganizationId,
          client_id: otherClientId,
          status: "ACTIVE",
        },
      ],
    });
    await prisma.careRoomMembership.create({
      data: {
        id: familyCareRoomMembershipId,
        care_room_id: familyCareRoomId,
        family_contact_id: familyContactId,
        organization_membership_invitation_id: familyInvitationId,
        role: "FAMILY_VIEWER",
        status: "ACTIVE",
        access_basis: "CLIENT_CONSENT",
        accepted_at: new Date("2026-07-12T08:00:00.000Z"),
        access_grants: {
          create: [
            { scope: "VIEW_UPDATES" },
            { scope: "VIEW_TASK_SUMMARY" },
            { scope: "RAISE_CONCERNS" },
          ],
        },
      },
    });
    await prisma.verifiedVisitStory.createMany({
      data: [
        {
          id: familyStoryId,
          organization_id: organizationId,
          care_room_id: familyCareRoomId,
          client_id: clientId,
          visit_id: familyVisitId,
          status: "PUBLISHED",
          draft_title: "Private own-tenant draft title",
          draft_body: "Private own-tenant draft with medication details",
          family_safe_version: 1,
          family_safe_title: "A comfortable morning visit",
          family_safe_body: "The planned support was completed.",
          source_refs: [{ type: "Visit", id: familyVisitId }],
          published_at: new Date("2026-07-12T10:30:00.000Z"),
        },
        {
          id: crossOrganizationFamilyStoryId,
          organization_id: otherOrganizationId,
          care_room_id: crossOrganizationCareRoomId,
          client_id: otherClientId,
          visit_id: crossOrganizationFamilyVisitId,
          status: "PUBLISHED",
          draft_title: "Cross-tenant private draft",
          draft_body: "Cross-tenant private medication narrative",
          family_safe_version: 1,
          family_safe_title: "Cross-tenant family update",
          family_safe_body: "Cross-tenant family-safe body",
          source_refs: [{ type: "Visit", id: crossOrganizationFamilyVisitId }],
          published_at: new Date("2026-07-12T10:31:00.000Z"),
        },
      ],
    });
  }

  const managerAndPendingSummariesQuery = `
    query ManagerTenantProof {
      viewerAccessSnapshot {
        effectiveRole
        membershipState
        organizationId
        surface
        capabilities
      }
      listPendingSummaries {
        items {
          id
          clientId
        }
        total
      }
    }
  `;

  const startVisitMutation = `
    mutation StartVisit($visitId: String!) {
      startVisit(visitId: $visitId) {
        id
        carerId
        status
      }
    }
  `;

  it("uses Manager database authority and returns only own-tenant data despite an admin token role", async () => {
    const response = await graphql(
      bearer(managerSubject, externalOrganizationId, "org:admin"),
      managerAndPendingSummariesQuery,
    ).expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.viewerAccessSnapshot).toMatchObject({
      effectiveRole: "manager",
      membershipState: "ACTIVE",
      organizationId,
      surface: "STAFF",
      capabilities: ["PROFILE_HELP_VIEW", "AI_SUMMARY_REVIEW", "GDPR_MANAGE"],
    });
    expect(response.body.data.viewerAccessSnapshot.capabilities).not.toContain(
      "TENANT_ADMIN",
    );
    expect(response.body.data.listPendingSummaries).toEqual({
      items: [{ id: ownSummaryId, clientId }],
      total: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain(otherSummaryId);
    expect(JSON.stringify(response.body)).not.toContain(otherClientId);
  });

  it("denies Manager direct GraphQL data access when the Clerk organization claim conflicts", async () => {
    const token = bearer(
      managerSubject,
      otherExternalOrganizationId,
      "org:admin",
    );
    const snapshot = await graphql(
      token,
      `
        query MismatchedManagerSnapshot {
          viewerAccessSnapshot {
            effectiveRole
            membershipState
            organizationId
            surface
            capabilities
          }
        }
      `,
    ).expect(200);

    expect(snapshot.body.errors).toBeUndefined();
    expect(snapshot.body.data.viewerAccessSnapshot).toEqual({
      effectiveRole: null,
      membershipState: "ORGANIZATION_MISMATCH",
      organizationId: null,
      surface: "NONE",
      capabilities: [],
    });

    const response = await graphql(
      token,
      `
        query DeniedManagerTenantData {
          listPendingSummaries {
            items {
              id
              clientId
            }
            total
          }
        }
      `,
    ).expect(200);

    expect(response.body.data?.listPendingSummaries ?? null).toBeNull();
    expect(response.body.errors).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain(ownSummaryId);
    expect(JSON.stringify(response.body)).not.toContain(otherSummaryId);
    expect(JSON.stringify(response.body)).not.toContain(managerSubject);
  });

  it("limits an explicitly granted Family member to family-safe data and revokes access immediately", async () => {
    const token = bearer(familySubject);
    const familyView = await graphql(
      token,
      `
        query FamilyTenantProof($careRoomId: String!) {
          viewerAccessSnapshot {
            effectiveRole
            membershipState
            organizationId
            surface
            capabilities
          }
          familyCareRoom(id: $careRoomId) {
            id
            clientDisplayName
          }
          familyVerifiedVisitStories(careRoomId: $careRoomId) {
            title
            body
            publishedAt
          }
        }
      `,
      { careRoomId: familyCareRoomId },
    ).expect(200);

    expect(familyView.body.errors).toBeUndefined();
    expect(familyView.body.data.viewerAccessSnapshot).toEqual({
      effectiveRole: "family",
      membershipState: "ACTIVE",
      organizationId,
      surface: "FAMILY",
      capabilities: ["FAMILY_UPDATES_VIEW", "FAMILY_CONCERN_CREATE"],
    });
    expect(familyView.body.data.familyCareRoom).toEqual({
      id: familyCareRoomId,
      clientDisplayName: "Own tenant client",
    });
    expect(familyView.body.data.familyVerifiedVisitStories).toEqual([
      {
        title: "A comfortable morning visit",
        body: "The planned support was completed.",
        publishedAt: "2026-07-12T10:30:00.000Z",
      },
    ]);
    const serializedFamilyView = JSON.stringify(familyView.body);
    expect(serializedFamilyView).not.toContain("Private own-tenant draft");
    expect(serializedFamilyView).not.toContain(
      "Private own-tenant care narrative",
    );
    expect(serializedFamilyView).not.toContain(otherClientId);
    expect(serializedFamilyView).not.toContain(crossOrganizationFamilyStoryId);
    expect(serializedFamilyView).not.toContain("Cross-tenant");

    const forbiddenFields = await graphql(
      token,
      `
        query UnsafeFamilyFields($careRoomId: String!) {
          familyCareRoom(id: $careRoomId) {
            id
            memberships {
              id
            }
          }
          familyVerifiedVisitStories(careRoomId: $careRoomId) {
            title
            draftBody
            sourceRefs
          }
        }
      `,
      { careRoomId: familyCareRoomId },
    ).expect(400);
    expect(
      forbiddenFields.body.errors
        .map((error: { message: string }) => error.message)
        .join(" "),
    ).toContain('Cannot query field "memberships"');
    expect(JSON.stringify(forbiddenFields.body)).not.toContain(
      "Private own-tenant draft with medication details",
    );

    const crossOrganization = await graphql(
      token,
      `
        query FamilyRoom($id: String!) {
          familyCareRoom(id: $id) {
            id
          }
        }
      `,
      { id: crossOrganizationCareRoomId },
    ).expect(200);
    const missing = await graphql(
      token,
      `
        query FamilyRoom($id: String!) {
          familyCareRoom(id: $id) {
            id
          }
        }
      `,
      { id: "80000000-0000-4000-8000-999999999999" },
    ).expect(200);
    expect(crossOrganization.body.data?.familyCareRoom ?? null).toBeNull();
    expect(missing.body.data?.familyCareRoom ?? null).toBeNull();
    expect(crossOrganization.body.errors).toHaveLength(1);
    expect(missing.body.errors).toHaveLength(1);
    expect(crossOrganization.body.errors[0].message).toBe(
      missing.body.errors[0].message,
    );
    expect(JSON.stringify(crossOrganization.body)).not.toContain(otherClientId);
    expect(JSON.stringify(crossOrganization.body)).not.toContain(
      crossOrganizationFamilyStoryId,
    );

    const concernMutation = `
      mutation RaiseFamilyConcern($input: RaiseConcernInput!) {
        raiseFamilyCarebridgeConcern(input: $input) {
          title
          status
        }
      }
    `;
    const concernInput = {
      careRoomId: familyCareRoomId,
      title: "Please call when available",
      description: "Synthetic family concern before revocation",
      severity: "LOW",
      category: "COMMUNICATION",
    };
    const concernBeforeRevocation = await graphql(token, concernMutation, {
      input: concernInput,
    }).expect(200);
    expect(concernBeforeRevocation.body.errors).toBeUndefined();
    expect(
      concernBeforeRevocation.body.data.raiseFamilyCarebridgeConcern,
    ).toEqual({
      title: concernInput.title,
      status: "OPEN",
    });
    expect(
      await prisma.concern.count({
        where: { organization_id: organizationId },
      }),
    ).toBe(1);

    const revokedAt = new Date("2026-07-13T12:00:00.000Z");
    await prisma.$transaction([
      prisma.careRoomMembership.update({
        where: { id: familyCareRoomMembershipId },
        data: { status: "REVOKED", revoked_at: revokedAt },
      }),
      prisma.accessGrant.updateMany({
        where: {
          care_room_membership_id: familyCareRoomMembershipId,
          revoked_at: null,
        },
        data: { revoked_at: revokedAt },
      }),
    ]);

    const readAfterRevocation = await graphql(
      token,
      `
        query RevokedFamilyRead {
          familyCareRooms {
            id
            clientDisplayName
          }
        }
      `,
    ).expect(200);
    expect(readAfterRevocation.body.data?.familyCareRooms ?? null).toBeNull();
    expect(readAfterRevocation.body.errors).toHaveLength(1);
    expect(JSON.stringify(readAfterRevocation.body)).not.toContain(clientId);
    expect(JSON.stringify(readAfterRevocation.body)).not.toContain(
      familyStoryId,
    );

    const concernAfterRevocation = await graphql(token, concernMutation, {
      input: {
        ...concernInput,
        title: "Must not persist after revocation",
      },
    }).expect(200);
    expect(
      concernAfterRevocation.body.data?.raiseFamilyCarebridgeConcern ?? null,
    ).toBeNull();
    expect(concernAfterRevocation.body.errors).toHaveLength(1);
    expect(JSON.stringify(concernAfterRevocation.body)).not.toContain(clientId);
    expect(
      await prisma.concern.count({
        where: { organization_id: organizationId },
      }),
    ).toBe(1);
    await expect(
      prisma.careRoomMembership.findUniqueOrThrow({
        where: { id: familyCareRoomMembershipId },
        include: { access_grants: true },
      }),
    ).resolves.toMatchObject({
      status: "REVOKED",
      revoked_at: revokedAt,
      access_grants: [
        { revoked_at: revokedAt },
        { revoked_at: revokedAt },
        { revoked_at: revokedAt },
      ],
    });
  });

  it("allows the linked assigned Carer through the real visit repository and service", async () => {
    const response = await graphql(
      bearer(carerSubject, externalOrganizationId, "org:admin"),
      startVisitMutation,
      { visitId: assignedVisitId },
    ).expect(200);

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.startVisit).toEqual({
      id: assignedVisitId,
      carerId: assignedCarerId,
      status: "IN_PROGRESS",
    });
    await expect(
      prisma.visit.findUniqueOrThrow({ where: { id: assignedVisitId } }),
    ).resolves.toMatchObject({
      status: VisitStatus.IN_PROGRESS,
      carer_id: assignedCarerId,
    });
  });

  it.each([
    ["unassigned visit", carerSubject, unassignedVisitId],
    ["another Carer assignment", otherCarerSubject, assignedVisitId],
  ])(
    "denies %s without changing the visit",
    async (_label, subject, visitId) => {
      const response = await graphql(bearer(subject), startVisitMutation, {
        visitId,
      }).expect(200);

      expect(response.body.data?.startVisit ?? null).toBeNull();
      expect(response.body.errors).toHaveLength(1);
      expect(JSON.stringify(response.body)).not.toContain(clientId);
      await expect(
        prisma.visit.findUniqueOrThrow({ where: { id: visitId } }),
      ).resolves.toMatchObject({ status: VisitStatus.SCHEDULED });
    },
  );

  it("makes a cross-organization visit identifier indistinguishable from a missing identifier", async () => {
    const token = bearer(carerSubject);
    const crossOrganization = await graphql(token, startVisitMutation, {
      visitId: crossOrganizationVisitId,
    }).expect(200);
    const missing = await graphql(token, startVisitMutation, {
      visitId: "30000000-0000-4000-8000-999999999999",
    }).expect(200);

    expect(crossOrganization.body.data?.startVisit ?? null).toBeNull();
    expect(missing.body.data?.startVisit ?? null).toBeNull();
    expect(crossOrganization.body.errors).toHaveLength(1);
    expect(crossOrganization.body.errors[0].message).toBe(
      missing.body.errors[0].message,
    );
    expect(JSON.stringify(crossOrganization.body)).not.toContain(otherClientId);
    expect(JSON.stringify(crossOrganization.body)).not.toContain(
      crossOrganizationCarerId,
    );
    await expect(
      prisma.visit.findUniqueOrThrow({
        where: { id: crossOrganizationVisitId },
      }),
    ).resolves.toMatchObject({ status: VisitStatus.SCHEDULED });
  });

  it("denies the same Clerk token immediately after membership revocation", async () => {
    const token = bearer(carerSubject);
    const beforeRevocation = await graphql(
      token,
      `
        query ActiveBeforeRevocation {
          viewerAccessSnapshot {
            membershipState
            effectiveRole
          }
        }
      `,
    ).expect(200);
    expect(beforeRevocation.body.data.viewerAccessSnapshot).toEqual({
      membershipState: "ACTIVE",
      effectiveRole: "carer",
    });

    await prisma.organizationMembership.updateMany({
      where: {
        identity_provider: "clerk",
        auth_subject: carerSubject,
        organization_id: organizationId,
      },
      data: { status: "REVOKED", revoked_at: new Date() },
    });

    const afterRevocation = await graphql(
      token,
      `
        query RevokedAccess {
          viewerAccessSnapshot {
            membershipState
            effectiveRole
            capabilities
          }
        }
      `,
    ).expect(200);
    expect(afterRevocation.body.data.viewerAccessSnapshot).toEqual({
      membershipState: "INACTIVE",
      effectiveRole: null,
      capabilities: [],
    });

    const mutation = await graphql(token, startVisitMutation, {
      visitId: assignedVisitId,
    }).expect(200);
    expect(mutation.body.data?.startVisit ?? null).toBeNull();
    expect(mutation.body.errors).toHaveLength(1);
    await expect(
      prisma.visit.findUniqueOrThrow({ where: { id: assignedVisitId } }),
    ).resolves.toMatchObject({ status: VisitStatus.SCHEDULED });
  });
});
