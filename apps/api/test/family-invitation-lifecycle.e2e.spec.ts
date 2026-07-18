import { INestApplication } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { JwtStrategy } from '@oasis/auth';
import { PrismaService } from '@oasis/db';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { StartedTestContainer } from 'testcontainers';
import { AuthAccessModule } from '../src/auth/auth-access.module';
import { CarebridgeModule } from '../src/carebridge/carebridge.module';
import { ClerkProvisioningError } from '../src/company-access/clerk-provisioning.adapter';
import { ClerkInvitationAdministrationAdapter } from '../src/invitation-lifecycle/clerk-invitation-administration.adapter';
import { ClerkInvitationVerificationAdapter } from '../src/invitation-lifecycle/clerk-invitation-verification.adapter';
import { startPostgres } from './utils/test-container';

describe('family invitation, grants, and family-safe GraphQL boundary', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let container: StartedTestContainer;
  const previousEnv = { ...process.env };
  const secret = 'phase-seven-family-lifecycle-secret';
  const organizationId = 'org-family-lifecycle';
  const otherOrganizationId = 'org-family-lifecycle-other';
  const externalOrganizationId = 'org_external_family_lifecycle';
  const otherExternalOrganizationId = 'org_external_family_lifecycle_other';
  const adminSubject = 'admin_family_lifecycle';
  const familySubject = 'family_lifecycle_subject';
  const adminClerk = {
    ensureOrganizationInvitation: jest.fn(),
    revokeOrganizationInvitation: jest.fn(),
    revokeOrganizationInvitationByInternalId: jest.fn(),
    removeOrganizationMembership: jest.fn(),
  };
  const verifyClerk = {
    listAcceptedInvitationsForUser: jest.fn(),
    getOrganizationMembership: jest.fn(),
  };
  let roomId: string;
  let otherRoomId: string;
  let clientId: string;

  beforeAll(async () => {
    const started = await startPostgres();
    container = started.container;
    process.env.DATABASE_URL = started.dbUrl;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = secret;
    process.env.AUTH_IDENTITY_PROVIDER = 'clerk';
    process.env.CLERK_ISSUER = 'https://clerk.example.test';
    process.env.CLERK_AUDIENCE = 'oasis-api';
    process.env.CLERK_AUTHORIZED_PARTIES = 'https://care.example.test';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          playground: false,
          context: ({ req }: any) => ({ req }),
        }),
        AuthAccessModule,
        CarebridgeModule,
      ],
      providers: [JwtStrategy],
    })
      .overrideProvider(ClerkInvitationAdministrationAdapter)
      .useValue(adminClerk)
      .overrideProvider(ClerkInvitationVerificationAdapter)
      .useValue(verifyClerk)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
    process.env = { ...previousEnv };
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    adminClerk.ensureOrganizationInvitation.mockImplementation(
      async ({ invitationId }: { invitationId: string }) => ({
        externalInvitationId: `external_${invitationId}`,
      }),
    );
    adminClerk.revokeOrganizationInvitationByInternalId.mockResolvedValue(undefined);

    await prisma.auditLog.deleteMany();
    await prisma.concernMessage.deleteMany();
    await prisma.concernEvent.deleteMany();
    await prisma.concern.deleteMany();
    await prisma.verifiedVisitStory.deleteMany();
    await prisma.accessGrant.deleteMany();
    await prisma.careRoomMembership.deleteMany();
    await prisma.familyContact.deleteMany();
    await prisma.careRoom.deleteMany();
    await prisma.visitTask.deleteMany();
    await prisma.visit.deleteMany();
    await prisma.carer.deleteMany();
    await prisma.client.deleteMany();
    await prisma.organizationProvisioningOutbox.deleteMany();
    await prisma.organizationMembershipInvitation.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.organizationProviderBinding.deleteMany();
    await prisma.organization.deleteMany();

    await prisma.organization.createMany({
      data: [
        { id: organizationId, name: 'Family Lifecycle Care' },
        { id: otherOrganizationId, name: 'Family Lifecycle Sentinel' },
      ],
    });
    await prisma.organizationProviderBinding.createMany({
      data: [
        {
          organization_id: organizationId,
          identity_provider: 'clerk',
          external_organization_id: externalOrganizationId,
          external_slug: 'family-lifecycle-care',
        },
        {
          organization_id: otherOrganizationId,
          identity_provider: 'clerk',
          external_organization_id: otherExternalOrganizationId,
          external_slug: 'family-lifecycle-sentinel',
        },
      ],
    });
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: 'clerk',
        auth_subject: adminSubject,
        normalized_email: 'admin-family@example.test',
        role: 'admin',
        status: 'ACTIVE',
        external_organization_id: externalOrganizationId,
        external_membership_id: 'orgmem_admin_family_lifecycle',
      },
    });
    const client = await prisma.client.create({
      data: {
        organization_id: organizationId,
        full_name: 'Synthetic Mary',
        address_line1: '1 Test Street',
        city: 'Leeds',
        postcode: 'LS1 1AA',
      },
    });
    clientId = client.id;
    const otherClient = await prisma.client.create({
      data: {
        organization_id: otherOrganizationId,
        full_name: 'Sentinel Client',
        address_line1: '2 Test Street',
        city: 'York',
        postcode: 'YO1 1AA',
      },
    });
    roomId = (
      await prisma.careRoom.create({
        data: { organization_id: organizationId, client_id: client.id },
      })
    ).id;
    otherRoomId = (
      await prisma.careRoom.create({
        data: { organization_id: otherOrganizationId, client_id: otherClient.id },
      })
    ).id;
  });

  function bearer(subject: string, includeOrganization = true) {
    return `Bearer ${jwt.sign(
      {
        sub: subject,
        iss: process.env.CLERK_ISSUER,
        aud: process.env.CLERK_AUDIENCE,
        azp: process.env.CLERK_AUTHORIZED_PARTIES,
        ...(includeOrganization
          ? {
              org_id: externalOrganizationId,
              org_role: subject === adminSubject ? 'org:admin' : 'org:member',
            }
          : {}),
      },
      secret,
      { expiresIn: '1h' },
    )}`;
  }

  function gql(token: string, query: string, variables?: unknown) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', token)
      .send({ query, variables });
  }

  it('moves from exact pending invitation through explicit grants to immediate revocation', async () => {
    const invited = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteFamilyContactInput!) {
        inviteFamilyContact(input: $input) {
          id invitationId status invitationStatus deliveryStatus
          familyContact { email }
          accessGrants { scope }
        }
      }`,
      {
        input: {
          careRoomId: roomId,
          fullName: 'Synthetic Relative',
          email: 'relative-family@example.test',
          relationship: 'Daughter',
          role: 'FAMILY_VIEWER',
          accessBasis: 'CLIENT_CONSENT',
        },
      },
    ).expect(200);
    expect(invited.body.errors).toBeUndefined();
    expect(invited.body.data.inviteFamilyContact).toMatchObject({
      status: 'INVITED',
      invitationStatus: 'PENDING',
      deliveryStatus: 'DELIVERED',
      familyContact: { email: 'relative-family@example.test' },
      accessGrants: [],
    });
    const careRoomMembershipId = invited.body.data.inviteFamilyContact.id;
    const invitationId = invited.body.data.inviteFamilyContact.invitationId;
    expect(adminClerk.ensureOrganizationInvitation).toHaveBeenCalledWith({
      externalOrganizationId,
      invitationId,
      emailAddress: 'relative-family@example.test',
      intendedRole: 'family',
    });

    verifyClerk.listAcceptedInvitationsForUser.mockResolvedValue([
      {
        id: `external_${invitationId}`,
        organizationId: externalOrganizationId,
        emailAddress: 'relative-family@example.test',
        role: 'org:member',
        publicMetadata: { oasis_invitation_id: invitationId },
        privateMetadata: { oasis_invitation_id: invitationId },
      },
    ]);
    verifyClerk.getOrganizationMembership.mockResolvedValue({
      id: 'orgmem_family_lifecycle',
      organizationId: externalOrganizationId,
      userId: familySubject,
      role: 'org:member',
    });
    const activated = await gql(
      bearer(familySubject, false),
      `mutation Activate($input: InvitationActivationInputDTO!) {
        activateViewerOrganizationInvitation(input: $input) { status nextPath }
      }`,
      { input: { invitationId } },
    ).expect(200);
    expect(activated.body.errors).toBeUndefined();
    expect(activated.body.data.activateViewerOrganizationInvitation).toEqual({
      status: 'ACTIVE',
      nextPath: '/family',
    });

    const zeroGrantRooms = await gql(
      bearer(familySubject),
      `{ familyCareRooms { id clientDisplayName } }`,
    ).expect(200);
    expect(zeroGrantRooms.body.errors).toBeUndefined();
    expect(zeroGrantRooms.body.data.familyCareRooms).toEqual([]);

    const partialGrant = await gql(
      bearer(adminSubject),
      `mutation Grant($input: UpdateFamilyAccessGrantsInput!) {
        updateFamilyAccessGrants(input: $input) {
          id status accessGrants { scope }
        }
      }`,
      {
        input: {
          careRoomMembershipId,
          scopes: ['VIEW_UPDATES'],
        },
      },
    ).expect(200);
    expect(partialGrant.body.errors).toHaveLength(1);
    expect(await prisma.accessGrant.count({
      where: { care_room_membership_id: careRoomMembershipId },
    })).toBe(0);
    const partialStoryAccess = await gql(
      bearer(familySubject),
      `query Stories($id: String!) {
        familyVerifiedVisitStories(careRoomId: $id) { title body publishedAt }
      }`,
      { id: roomId },
    ).expect(200);
    expect(partialStoryAccess.body.errors).toHaveLength(1);

    const granted = await gql(
      bearer(adminSubject),
      `mutation Grant($input: UpdateFamilyAccessGrantsInput!) {
        updateFamilyAccessGrants(input: $input) {
          id status accessGrants { scope }
        }
      }`,
      {
        input: {
          careRoomMembershipId,
          scopes: ['VIEW_UPDATES', 'VIEW_TASK_SUMMARY'],
        },
      },
    ).expect(200);
    expect(granted.body.errors).toBeUndefined();
    expect(granted.body.data.updateFamilyAccessGrants.accessGrants).toEqual(
      expect.arrayContaining([
        { scope: 'VIEW_UPDATES' },
        { scope: 'VIEW_TASK_SUMMARY' },
      ]),
    );
    expect(granted.body.data.updateFamilyAccessGrants.accessGrants).toHaveLength(2);

    const concernOnly = await gql(
      bearer(adminSubject),
      `mutation Grant($input: UpdateFamilyAccessGrantsInput!) {
        updateFamilyAccessGrants(input: $input) { accessGrants { scope } }
      }`,
      { input: { careRoomMembershipId, scopes: ['RAISE_CONCERNS'] } },
    ).expect(200);
    expect(concernOnly.body.errors).toBeUndefined();
    const concernOnlyRooms = await gql(
      bearer(familySubject),
      `{ familyCareRooms { id clientDisplayName canViewApprovedUpdates canRaiseConcerns } }`,
    ).expect(200);
    expect(concernOnlyRooms.body.errors).toBeUndefined();
    expect(concernOnlyRooms.body.data.familyCareRooms).toEqual([{
      id: roomId,
      clientDisplayName: 'Synthetic Mary',
      canViewApprovedUpdates: false,
      canRaiseConcerns: true,
    }]);
    const concernOnlyStories = await gql(
      bearer(familySubject),
      `query Stories($id: String!) {
        familyVerifiedVisitStories(careRoomId: $id) { title }
      }`,
      { id: roomId },
    ).expect(200);
    expect(concernOnlyStories.body.errors).toHaveLength(1);
    const raisedConcern = await gql(
      bearer(familySubject),
      `mutation Concern($input: RaiseConcernInput!) {
        raiseFamilyCarebridgeConcern(input: $input) { title status }
      }`,
      { input: {
        careRoomId: roomId,
        title: 'Please call about today',
        severity: 'MEDIUM',
        category: 'COMMUNICATION',
      } },
    ).expect(200);
    expect(raisedConcern.body.errors).toBeUndefined();
    expect(raisedConcern.body.data.raiseFamilyCarebridgeConcern).toMatchObject({
      title: 'Please call about today',
    });

    await gql(
      bearer(adminSubject),
      `mutation Grant($input: UpdateFamilyAccessGrantsInput!) {
        updateFamilyAccessGrants(input: $input) { accessGrants { scope } }
      }`,
      { input: {
        careRoomMembershipId,
        scopes: ['VIEW_UPDATES', 'VIEW_TASK_SUMMARY'],
      } },
    ).expect(200);
    const concernCount = await prisma.concern.count();
    const deniedConcern = await gql(
      bearer(familySubject),
      `mutation Concern($input: RaiseConcernInput!) {
        raiseFamilyCarebridgeConcern(input: $input) { title status }
      }`,
      { input: {
        careRoomId: roomId,
        title: 'This must not be written',
        severity: 'LOW',
        category: 'OTHER',
      } },
    ).expect(200);
    expect(deniedConcern.body.errors).toHaveLength(1);
    expect(await prisma.concern.count()).toBe(concernCount);

    const carer = await prisma.carer.create({
      data: {
        organization_id: organizationId,
        first_name: 'Synthetic',
        last_name: 'Carer',
        email: 'synthetic-family-story-carer@example.test',
      },
    });
    const visit = await prisma.visit.create({
      data: {
        organization_id: organizationId,
        client_id: clientId,
        carer_id: carer.id,
        scheduled_start: new Date('2026-07-10T09:00:00Z'),
        scheduled_end: new Date('2026-07-10T10:00:00Z'),
        status: 'COMPLETED',
        notes: 'Raw medication note: never expose this to family.',
      },
    });
    await prisma.visitTask.createMany({
      data: [
        {
          visit_id: visit.id,
          task_name: 'Medication prompt',
          notes: 'Internal medication detail',
          is_completed: true,
          completed_at: new Date('2026-07-10T09:30:00Z'),
        },
        {
          visit_id: visit.id,
          task_name: 'Confidential follow-up',
          is_completed: false,
        },
      ],
    });
    const generated = await gql(
      bearer(adminSubject),
      `mutation Generate($visitId: String!) {
        generateVerifiedVisitStory(visitId: $visitId) {
          id status draftBody familySafeVersion familySafeTitle familySafeBody
        }
      }`,
      { visitId: visit.id },
    ).expect(200);
    expect(generated.body.errors).toBeUndefined();
    expect(generated.body.data.generateVerifiedVisitStory.draftBody).toContain('Confidential follow-up');
    expect(generated.body.data.generateVerifiedVisitStory.draftBody).not.toContain('Medication prompt');
    expect(generated.body.data.generateVerifiedVisitStory.draftBody).not.toContain('Raw medication note');
    expect(generated.body.data.generateVerifiedVisitStory.draftBody).not.toContain('Internal medication detail');
    expect(generated.body.data.generateVerifiedVisitStory).toMatchObject({
      familySafeVersion: 1,
      familySafeTitle: 'Care visit update',
      familySafeBody: 'The scheduled care visit was completed. 0 care tasks were recorded as completed. 1 care task needs follow-up.',
    });
    const generatedStoryId = generated.body.data.generateVerifiedVisitStory.id;
    const published = await gql(
      bearer(adminSubject),
      `mutation Publish($storyId: String!) {
        publishVerifiedVisitStory(storyId: $storyId) { id status approvedBody publishedAt }
      }`,
      { storyId: generatedStoryId },
    ).expect(200);
    expect(published.body.errors).toBeUndefined();
    expect(published.body.data.publishVerifiedVisitStory.approvedBody).toBe(
      'The scheduled care visit was completed. 0 care tasks were recorded as completed. 1 care task needs follow-up.',
    );
    expect(published.body.data.publishVerifiedVisitStory.approvedBody).not.toContain('Medication prompt');
    expect(published.body.data.publishVerifiedVisitStory.approvedBody).not.toContain('Raw medication note');
    const familyPublishedAt = published.body.data.publishVerifiedVisitStory.publishedAt;

    await prisma.verifiedVisitStory.createMany({
      data: [
        {
          organization_id: organizationId,
          care_room_id: roomId,
          client_id: clientId,
          visit_id: visit.id,
          status: 'PUBLISHED',
          draft_title: 'Internal draft title',
          draft_body: 'Internal care note with medication instructions.',
          approved_title: 'A calm morning visit',
          approved_body: 'Medication prompt omitted. Raw staff note remains internal.',
          source_refs: [{ type: 'Visit', id: visit.id }],
          approved_by_id: adminSubject,
          approved_at: new Date('2026-07-10T11:00:00Z'),
          published_at: new Date('2026-07-10T11:01:00Z'),
        },
        {
          organization_id: organizationId,
          care_room_id: roomId,
          client_id: clientId,
          visit_id: visit.id,
          status: 'PUBLISHED',
          draft_title: 'Older family-safe draft',
          draft_body: 'Older internal care note.',
          approved_title: 'Earlier care visit update',
          approved_body: 'An earlier scheduled care visit was completed.',
          family_safe_version: 1,
          family_safe_title: 'Earlier care visit update',
          family_safe_body: 'An earlier scheduled care visit was completed.',
          source_refs: [{ type: 'Visit', id: visit.id }],
          approved_by_id: adminSubject,
          approved_at: new Date('2026-07-10T10:00:00Z'),
          published_at: new Date('2026-07-10T10:01:00Z'),
        },
        {
          organization_id: organizationId,
          care_room_id: roomId,
          client_id: clientId,
          visit_id: visit.id,
          status: 'DRAFT',
          draft_title: 'Unpublished internal draft',
          draft_body: 'This must never be family visible.',
          source_refs: [{ type: 'Visit', id: visit.id }],
        },
      ],
    });

    const familyView = await gql(
      bearer(familySubject),
      `query Family($id: String!) {
        familyCareRoom(id: $id) { id clientDisplayName canViewApprovedUpdates canRaiseConcerns }
        familyVerifiedVisitStories(careRoomId: $id) { title body publishedAt }
      }`,
      { id: roomId },
    ).expect(200);
    expect(familyView.body.errors).toBeUndefined();
    expect(familyView.body.data.familyCareRoom).toEqual({
      id: roomId,
      clientDisplayName: 'Synthetic Mary',
      canViewApprovedUpdates: true,
      canRaiseConcerns: false,
    });
    expect(familyView.body.data.familyVerifiedVisitStories).toEqual([
      {
        title: 'Care visit update',
        body: 'The scheduled care visit was completed. 0 care tasks were recorded as completed. 1 care task needs follow-up.',
        publishedAt: familyPublishedAt,
      },
      {
        title: 'Earlier care visit update',
        body: 'An earlier scheduled care visit was completed.',
        publishedAt: '2026-07-10T10:01:00.000Z',
      },
    ]);

    const raceDraft = await gql(
      bearer(adminSubject),
      `mutation Generate($visitId: String!) {
        generateVerifiedVisitStory(visitId: $visitId) { id status }
      }`,
      { visitId: visit.id },
    ).expect(200);
    expect(raceDraft.body.errors).toBeUndefined();
    const raceStoryId = raceDraft.body.data.generateVerifiedVisitStory.id;
    const publishOrReject = await Promise.all([
      gql(
        bearer(adminSubject),
        `mutation Publish($storyId: String!) {
          publishVerifiedVisitStory(storyId: $storyId) { id status }
        }`,
        { storyId: raceStoryId },
      ).expect(200),
      gql(
        bearer(adminSubject),
        `mutation Reject($input: RejectVerifiedVisitStoryInput!) {
          rejectVerifiedVisitStory(input: $input) { id status }
        }`,
        { input: { storyId: raceStoryId, rejectionReason: 'Synthetic concurrency check' } },
      ).expect(200),
    ]);
    expect(publishOrReject.filter((result) => !result.body.errors)).toHaveLength(1);
    expect(publishOrReject.filter((result) => result.body.errors?.length === 1)).toHaveLength(1);
    await expect(
      prisma.verifiedVisitStory.findUniqueOrThrow({ where: { id: raceStoryId } }),
    ).resolves.toMatchObject({
      status: expect.stringMatching(/^(PUBLISHED|REJECTED)$/),
    });

    await prisma.visit.update({
      where: { id: visit.id },
      data: { status: 'CANCELLED' },
    });
    const correctedSource = await gql(
      bearer(familySubject),
      `query Stories($id: String!) {
        familyVerifiedVisitStories(careRoomId: $id) { title body publishedAt }
      }`,
      { id: roomId },
    ).expect(200);
    expect(correctedSource.body.errors).toBeUndefined();
    expect(correctedSource.body.data.familyVerifiedVisitStories).toEqual([]);

    const crossTenant = await gql(
      bearer(familySubject),
      `query Room($id: String!) { familyCareRoom(id: $id) { id } }`,
      { id: otherRoomId },
    ).expect(200);
    const nonexistent = await gql(
      bearer(familySubject),
      `query Room($id: String!) { familyCareRoom(id: $id) { id } }`,
      { id: '11111111-1111-4111-8111-111111111111' },
    ).expect(200);
    expect(crossTenant.body.errors).toHaveLength(1);
    expect(nonexistent.body.errors).toHaveLength(1);
    expect(crossTenant.body.errors[0].message).toBe(nonexistent.body.errors[0].message);

    const forbiddenRoomFields = await gql(
      bearer(familySubject),
      `{ familyCareRooms { id memberships { id } policy { id } } }`,
    ).expect(400);
    expect(forbiddenRoomFields.body.errors.map((error: any) => error.message).join(' ')).toContain(
      'Cannot query field "memberships"',
    );
    const forbiddenStoryFields = await gql(
      bearer(familySubject),
      `query Story($id: String!) {
        familyVerifiedVisitStories(careRoomId: $id) { title draftBody sourceRefs }
      }`,
      { id: roomId },
    ).expect(400);
    expect(forbiddenStoryFields.body.errors.map((error: any) => error.message).join(' ')).toContain(
      'Cannot query field "draftBody"',
    );
    const forbiddenConcernFields = await gql(
      bearer(familySubject),
      `mutation Concern($input: RaiseConcernInput!) {
        raiseFamilyCarebridgeConcern(input: $input) { title clientId messages { body } }
      }`,
      {
        input: {
          careRoomId: roomId,
          title: 'A family concern',
          severity: 'LOW',
          category: 'COMMUNICATION',
        },
      },
    ).expect(400);
    expect(forbiddenConcernFields.body.errors.map((error: any) => error.message).join(' ')).toContain(
      'Cannot query field "clientId"',
    );

    const [concurrentGrant, revoked] = await Promise.all([
      gql(
        bearer(adminSubject),
        `mutation Grant($input: UpdateFamilyAccessGrantsInput!) {
          updateFamilyAccessGrants(input: $input) { status accessGrants { scope } }
        }`,
        { input: { careRoomMembershipId, scopes: ['VIEW_UPDATES', 'VIEW_TASK_SUMMARY'] } },
      ).expect(200),
      gql(
        bearer(adminSubject),
        `mutation Revoke($input: FamilyMembershipActionInput!) {
          revokeFamilyAccess(input: $input) { status accessGrants { scope } }
        }`,
        { input: { careRoomMembershipId } },
      ).expect(200),
    ]);
    expect(revoked.body.errors).toBeUndefined();
    expect(revoked.body.data.revokeFamilyAccess).toEqual({
      status: 'REVOKED',
      accessGrants: [],
    });
    expect(
      concurrentGrant.body.errors === undefined || concurrentGrant.body.errors.length === 1,
    ).toBe(true);
    await expect(
      prisma.careRoomMembership.findUniqueOrThrow({
        where: { id: careRoomMembershipId },
        include: { access_grants: { where: { revoked_at: null } } },
      }),
    ).resolves.toMatchObject({ status: 'REVOKED', access_grants: [] });
    const afterRevocation = await gql(
      bearer(familySubject),
      `{ familyCareRooms { id } }`,
    ).expect(200);
    expect(afterRevocation.body.errors).toHaveLength(1);
    expect(afterRevocation.body.data).toBeNull();
  });

  it('blocks duplicate, wrong-room, partial, medication, and unused grant paths', async () => {
    const inviteMutation = `mutation Invite($input: InviteFamilyContactInput!) {
      inviteFamilyContact(input: $input) { id invitationId }
    }`;
    const input = {
      careRoomId: roomId,
      fullName: 'Duplicate Relative',
      email: 'duplicate-family@example.test',
      role: 'FAMILY_VIEWER',
      accessBasis: 'CLIENT_CONSENT',
    };
    const attempts = await Promise.all([
      gql(bearer(adminSubject), inviteMutation, { input }).expect(200),
      gql(bearer(adminSubject), inviteMutation, { input }).expect(200),
    ]);
    const successes = attempts.filter((attempt) => !attempt.body.errors);
    const conflicts = attempts.filter((attempt) => attempt.body.errors?.length === 1);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    const first = successes[0];
    expect(await prisma.familyContact.count({ where: { email: input.email } })).toBe(1);
    expect(
      await prisma.careRoomMembership.count({
        where: { family_contact: { email: input.email } },
      }),
    ).toBe(1);

    const invitationId = first.body.data.inviteFamilyContact.invitationId;
    await prisma.organizationMembershipInvitation.update({
      where: { id: invitationId },
      data: {
        external_invitation_id: null,
        created_at: new Date(Date.now() - 120_000),
        expires_at: new Date(Date.now() - 60_000),
      },
    });
    await prisma.organizationProvisioningOutbox.update({
      where: { invitation_id: invitationId },
      data: {
        status: 'RETRYABLE',
        delivered_at: null,
        lease_token: null,
        lease_expires_at: null,
        last_error_code: 'CLERK_TIMEOUT',
      },
    });
    adminClerk.revokeOrganizationInvitationByInternalId.mockClear();
    const overdueRetry = await gql(
      bearer(adminSubject),
      inviteMutation,
      { input },
    ).expect(200);
    expect(overdueRetry.body.errors).toBeUndefined();
    expect(overdueRetry.body.data.inviteFamilyContact).toMatchObject({
      id: first.body.data.inviteFamilyContact.id,
    });
    expect(overdueRetry.body.data.inviteFamilyContact.invitationId).not.toBe(invitationId);
    await expect(
      prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      }),
    ).resolves.toMatchObject({
      status: 'EXPIRED',
      expired_at: expect.any(Date),
      external_cleanup_required: false,
      external_cleanup_completed_at: expect.any(Date),
    });
    expect(adminClerk.revokeOrganizationInvitationByInternalId).toHaveBeenCalledWith({
      externalOrganizationId,
      invitationId,
      emailAddress: input.email,
      intendedRole: 'family',
    });
    await expect(
      prisma.careRoomMembership.findUniqueOrThrow({
        where: { id: first.body.data.inviteFamilyContact.id },
      }),
    ).resolves.toMatchObject({
      status: 'INVITED',
      organization_membership_invitation_id:
        overdueRetry.body.data.inviteFamilyContact.invitationId,
    });
    expect(await prisma.familyContact.count({ where: { email: input.email } })).toBe(1);
    expect(
      await prisma.careRoomMembership.count({
        where: { family_contact: { email: input.email } },
      }),
    ).toBe(1);

    const wrongRoom = await gql(bearer(adminSubject), inviteMutation, {
      input: { ...input, email: 'sentinel-family@example.test', careRoomId: otherRoomId },
    }).expect(200);
    expect(wrongRoom.body.errors).toHaveLength(1);
    expect(await prisma.familyContact.count({ where: { email: 'sentinel-family@example.test' } })).toBe(0);

    for (const scopes of [
      ['VIEW_UPDATES'],
      ['VIEW_TASK_SUMMARY'],
      ['VIEW_MEDICATION_SUPPORT_STATUS'],
      ['VIEW_VISIT_TIMES'],
      ['VIEW_WEEKLY_SUMMARIES'],
      ['REPLY_TO_CONCERNS'],
      ['SUBMIT_PULSE'],
    ]) {
      const deniedGrant = await gql(
        bearer(adminSubject),
        `mutation Grant($input: UpdateFamilyAccessGrantsInput!) {
          updateFamilyAccessGrants(input: $input) { id }
        }`,
        { input: {
          careRoomMembershipId: first.body.data.inviteFamilyContact.id,
          scopes,
        } },
      ).expect(200);
      expect(deniedGrant.body.errors).toHaveLength(1);
    }
    expect(await prisma.accessGrant.count()).toBe(0);
  });

  it('keeps an expired invitation blocked when ambiguous provider cleanup cannot be proven', async () => {
    const inviteMutation = `mutation Invite($input: InviteFamilyContactInput!) {
      inviteFamilyContact(input: $input) { id invitationId }
    }`;
    const input = {
      careRoomId: roomId,
      fullName: 'Ambiguous Relative',
      email: 'ambiguous-family@example.test',
      role: 'FAMILY_VIEWER',
      accessBasis: 'CLIENT_CONSENT',
    };
    const invited = await gql(
      bearer(adminSubject),
      inviteMutation,
      { input },
    ).expect(200);
    expect(invited.body.errors).toBeUndefined();
    const invitationId = invited.body.data.inviteFamilyContact.invitationId;
    const membershipId = invited.body.data.inviteFamilyContact.id;

    await prisma.organizationMembershipInvitation.update({
      where: { id: invitationId },
      data: {
        external_invitation_id: null,
        created_at: new Date(Date.now() - 120_000),
        expires_at: new Date(Date.now() - 60_000),
      },
    });
    await prisma.organizationProvisioningOutbox.update({
      where: { invitation_id: invitationId },
      data: {
        status: 'NEEDS_ATTENTION',
        delivered_at: null,
        last_error_code: 'CLERK_INVITATION_AMBIGUOUS',
      },
    });
    adminClerk.revokeOrganizationInvitationByInternalId.mockRejectedValueOnce(
      new ClerkProvisioningError('CLERK_INVITATION_AMBIGUOUS', false),
    );

    const reinvite = await gql(
      bearer(adminSubject),
      inviteMutation,
      { input },
    ).expect(200);
    expect(reinvite.body.errors).toHaveLength(1);
    expect(
      await prisma.organizationMembershipInvitation.count({
        where: { normalized_email: input.email },
      }),
    ).toBe(1);
    await expect(
      prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      }),
    ).resolves.toMatchObject({
      status: 'EXPIRED',
      external_cleanup_required: true,
      external_cleanup_error_code: 'CLERK_INVITATION_AMBIGUOUS',
      external_cleanup_completed_at: null,
    });
    await expect(
      prisma.careRoomMembership.findUniqueOrThrow({ where: { id: membershipId } }),
    ).resolves.toMatchObject({ status: 'EXPIRED' });
  });

  it('adds an already verified family member to a second CareRoom with zero grants', async () => {
    const email = 'verified-multi-room-family@example.test';
    const organizationMembership = await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: 'clerk',
        auth_subject: familySubject,
        normalized_email: email,
        role: 'family',
        status: 'ACTIVE',
        external_organization_id: externalOrganizationId,
        external_membership_id: 'orgmem_verified_multi_room_family',
      },
    });
    const acceptedInvitationId = 'accepted_verified_multi_room_family';
    await prisma.organizationMembershipInvitation.create({
      data: {
        id: acceptedInvitationId,
        organization_id: organizationId,
        activated_membership_id: organizationMembership.id,
        identity_provider: 'clerk',
        intended_email: email,
        normalized_email: email,
        intended_role: 'family',
        status: 'ACCEPTED',
        external_invitation_id: 'external_verified_multi_room_family',
        created_by_subject: adminSubject,
        bound_auth_subject: familySubject,
        created_at: new Date('2026-07-11T09:00:00Z'),
        accepted_at: new Date('2026-07-11T09:01:00Z'),
        expires_at: new Date('2026-07-18T09:00:00Z'),
      },
    });
    await prisma.organizationProvisioningOutbox.create({
      data: {
        id: 'outbox_verified_multi_room_family',
        organization_id: organizationId,
        invitation_id: acceptedInvitationId,
        status: 'DELIVERED',
        delivered_at: new Date('2026-07-11T09:00:30Z'),
      },
    });
    const contact = await prisma.familyContact.create({
      data: {
        organization_id: organizationId,
        full_name: 'Verified Relative',
        email,
        identity_type: 'clerk',
        auth_subject: familySubject,
      },
    });
    await prisma.careRoomMembership.create({
      data: {
        care_room_id: roomId,
        family_contact_id: contact.id,
        organization_membership_invitation_id: acceptedInvitationId,
        role: 'FAMILY_VIEWER',
        access_basis: 'CLIENT_CONSENT',
        status: 'ACTIVE',
        invited_by_user_id: adminSubject,
        accepted_at: new Date('2026-07-11T09:01:00Z'),
      },
    });
    const secondClient = await prisma.client.create({
      data: {
        organization_id: organizationId,
        full_name: 'Synthetic George',
        address_line1: '3 Test Street',
        city: 'Leeds',
        postcode: 'LS2 2AA',
      },
    });
    const secondRoom = await prisma.careRoom.create({
      data: { organization_id: organizationId, client_id: secondClient.id },
    });
    adminClerk.ensureOrganizationInvitation.mockClear();

    const added = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteFamilyContactInput!) {
        inviteFamilyContact(input: $input) {
          id invitationId status invitationStatus deliveryStatus accessGrants { scope }
        }
      }`,
      {
        input: {
          careRoomId: secondRoom.id,
          fullName: 'Verified Relative',
          email,
          role: 'FAMILY_VIEWER',
          accessBasis: 'CLIENT_CONSENT',
        },
      },
    ).expect(200);

    expect(added.body.errors).toBeUndefined();
    expect(added.body.data.inviteFamilyContact).toMatchObject({
      invitationId: acceptedInvitationId,
      status: 'ACTIVE',
      invitationStatus: 'ACCEPTED',
      deliveryStatus: 'DELIVERED',
      accessGrants: [],
    });
    expect(adminClerk.ensureOrganizationInvitation).not.toHaveBeenCalled();
    expect(
      await prisma.careRoomMembership.count({
        where: {
          family_contact_id: contact.id,
          organization_membership_invitation_id: acceptedInvitationId,
        },
      }),
    ).toBe(2);

    await gql(
      bearer(adminSubject),
      `mutation Grant($input: UpdateFamilyAccessGrantsInput!) {
        updateFamilyAccessGrants(input: $input) { id }
      }`,
      {
        input: {
          careRoomMembershipId: added.body.data.inviteFamilyContact.id,
          scopes: ['VIEW_UPDATES', 'VIEW_TASK_SUMMARY'],
        },
      },
    ).expect(200);
    const rooms = await gql(
      bearer(familySubject),
      `{ familyCareRooms { id clientDisplayName canViewApprovedUpdates canRaiseConcerns } }`,
    ).expect(200);
    expect(rooms.body.errors).toBeUndefined();
    expect(rooms.body.data.familyCareRooms).toEqual([
      {
        id: secondRoom.id,
        clientDisplayName: 'Synthetic George',
        canViewApprovedUpdates: true,
        canRaiseConcerns: false,
      },
    ]);
  });

  it('never binds the wrong account and expires the linked pending room membership', async () => {
    const invited = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteFamilyContactInput!) {
        inviteFamilyContact(input: $input) { id invitationId }
      }`,
      {
        input: {
          careRoomId: roomId,
          fullName: 'Expiring Relative',
          email: 'expiring-family@example.test',
          role: 'FAMILY_VIEWER',
          accessBasis: 'CLIENT_CONSENT',
        },
      },
    ).expect(200);
    expect(invited.body.errors).toBeUndefined();
    const membershipId = invited.body.data.inviteFamilyContact.id;
    const invitationId = invited.body.data.inviteFamilyContact.invitationId;

    verifyClerk.listAcceptedInvitationsForUser.mockResolvedValue([]);
    const wrongAccount = await gql(
      bearer('wrong_family_subject', false),
      `mutation Activate($input: InvitationActivationInputDTO!) {
        activateViewerOrganizationInvitation(input: $input) { status }
      }`,
      { input: { invitationId } },
    ).expect(200);
    expect(wrongAccount.body.errors).toHaveLength(1);
    await expect(
      prisma.familyContact.findFirstOrThrow({
        where: { memberships: { some: { id: membershipId } } },
      }),
    ).resolves.toMatchObject({ auth_subject: null });
    expect(await prisma.organizationMembership.count({ where: { role: 'family' } })).toBe(0);

    await prisma.organizationMembershipInvitation.update({
      where: { id: invitationId },
      data: {
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 60_000),
      },
    });
    verifyClerk.listAcceptedInvitationsForUser.mockResolvedValue([
      {
        id: `external_${invitationId}`,
        organizationId: externalOrganizationId,
        emailAddress: 'expiring-family@example.test',
        role: 'org:member',
        publicMetadata: { oasis_invitation_id: invitationId },
        privateMetadata: { oasis_invitation_id: invitationId },
      },
    ]);
    const expired = await gql(
      bearer(familySubject, false),
      `mutation Activate($input: InvitationActivationInputDTO!) {
        activateViewerOrganizationInvitation(input: $input) { status }
      }`,
      { input: { invitationId } },
    ).expect(200);
    expect(expired.body.errors).toHaveLength(1);
    await expect(
      prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      }),
    ).resolves.toMatchObject({ status: 'EXPIRED' });
    await expect(
      prisma.careRoomMembership.findUniqueOrThrow({ where: { id: membershipId } }),
    ).resolves.toMatchObject({ status: 'EXPIRED', accepted_at: null });
    expect(await prisma.organizationMembership.count({ where: { role: 'family' } })).toBe(0);
  });

  it('quarantines legacy active room grants that have no accepted invitation provenance', async () => {
    await prisma.organizationMembership.create({
      data: {
        organization_id: organizationId,
        identity_provider: 'clerk',
        auth_subject: familySubject,
        normalized_email: 'legacy-family@example.test',
        role: 'family',
        status: 'ACTIVE',
        external_organization_id: externalOrganizationId,
        external_membership_id: 'orgmem_legacy_family_lifecycle',
      },
    });
    const contact = await prisma.familyContact.create({
      data: {
        organization_id: organizationId,
        full_name: 'Legacy Relative',
        email: 'legacy-family@example.test',
        identity_type: 'clerk',
        auth_subject: familySubject,
      },
    });
    const membership = await prisma.careRoomMembership.create({
      data: {
        care_room_id: roomId,
        family_contact_id: contact.id,
        role: 'FAMILY_VIEWER',
        access_basis: 'CLIENT_CONSENT',
        status: 'ACTIVE',
        accepted_at: new Date(),
      },
    });
    await prisma.accessGrant.create({
      data: {
        care_room_membership_id: membership.id,
        scope: 'VIEW_UPDATES',
      },
    });

    const rooms = await gql(
      bearer(familySubject),
      `{ familyCareRooms { id clientDisplayName } }`,
    ).expect(200);
    expect(rooms.body.errors).toBeUndefined();
    expect(rooms.body.data.familyCareRooms).toEqual([]);

    const direct = await gql(
      bearer(familySubject),
      `query Room($id: String!) { familyCareRoom(id: $id) { id } }`,
      { id: roomId },
    ).expect(200);
    expect(direct.body.errors).toHaveLength(1);
  });

  it('persists retryable delivery and revokes the exact pending Clerk invitation', async () => {
    adminClerk.ensureOrganizationInvitation.mockRejectedValueOnce(
      new ClerkProvisioningError('CLERK_TIMEOUT', true),
    );
    const invited = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteFamilyContactInput!) {
        inviteFamilyContact(input: $input) {
          id invitationId status deliveryStatus accessGrants { scope }
        }
      }`,
      {
        input: {
          careRoomId: roomId,
          fullName: 'Retry Relative',
          email: 'retry-family@example.test',
          role: 'FAMILY_VIEWER',
          accessBasis: 'CLIENT_CONSENT',
        },
      },
    ).expect(200);
    expect(invited.body.errors).toBeUndefined();
    expect(invited.body.data.inviteFamilyContact).toMatchObject({
      status: 'INVITED',
      deliveryStatus: 'RETRYABLE',
      accessGrants: [],
    });
    const invitationId = invited.body.data.inviteFamilyContact.invitationId;

    adminClerk.ensureOrganizationInvitation.mockClear();
    adminClerk.ensureOrganizationInvitation.mockResolvedValue({
      externalInvitationId: `external_${invitationId}`,
    });
    const retries = await Promise.all([
      gql(
        bearer(adminSubject),
        `mutation Retry($input: FamilyInvitationActionInput!) {
          retryFamilyInvitationDelivery(input: $input) { deliveryStatus invitationStatus }
        }`,
        { input: { invitationId } },
      ).expect(200),
      gql(
        bearer(adminSubject),
        `mutation Retry($input: FamilyInvitationActionInput!) {
          retryFamilyInvitationDelivery(input: $input) { deliveryStatus invitationStatus }
        }`,
        { input: { invitationId } },
      ).expect(200),
    ]);
    expect(adminClerk.ensureOrganizationInvitation).toHaveBeenCalledTimes(1);
    expect(retries.some((retry) => !retry.body.errors)).toBe(true);
    await expect(
      prisma.organizationProvisioningOutbox.findUniqueOrThrow({
        where: { invitation_id: invitationId },
      }),
    ).resolves.toMatchObject({
      status: 'DELIVERED',
    });

    const revoked = await gql(
      bearer(adminSubject),
      `mutation Revoke($input: FamilyInvitationActionInput!) {
        revokeFamilyInvitation(input: $input) { status invitationStatus cleanupStatus }
      }`,
      { input: { invitationId } },
    ).expect(200);
    expect(revoked.body.errors).toBeUndefined();
    expect(revoked.body.data.revokeFamilyInvitation).toEqual({
      status: 'REVOKED',
      invitationStatus: 'REVOKED',
      cleanupStatus: 'COMPLETE',
    });
    expect(adminClerk.revokeOrganizationInvitationByInternalId).toHaveBeenCalledWith({
      externalOrganizationId,
      invitationId,
      emailAddress: 'retry-family@example.test',
      intendedRole: 'family',
    });

    adminClerk.ensureOrganizationInvitation.mockImplementation(
      async ({ invitationId: replacementId }: { invitationId: string }) => ({
        externalInvitationId: `external_${replacementId}`,
      }),
    );
    const reissued = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteFamilyContactInput!) {
        inviteFamilyContact(input: $input) { id invitationId status deliveryStatus accessGrants { scope } }
      }`,
      {
        input: {
          careRoomId: roomId,
          fullName: 'Retry Relative',
          email: 'retry-family@example.test',
          role: 'FAMILY_VIEWER',
          accessBasis: 'CLIENT_CONSENT',
        },
      },
    ).expect(200);
    expect(reissued.body.errors).toBeUndefined();
    expect(reissued.body.data.inviteFamilyContact).toMatchObject({
      id: invited.body.data.inviteFamilyContact.id,
      status: 'INVITED',
      deliveryStatus: 'DELIVERED',
      accessGrants: [],
    });
    expect(reissued.body.data.inviteFamilyContact.invitationId).not.toBe(
      invitationId,
    );
    expect(
      await prisma.familyContact.count({
        where: { email: 'retry-family@example.test' },
      }),
    ).toBe(1);
    expect(
      await prisma.careRoomMembership.count({
        where: { family_contact: { email: 'retry-family@example.test' } },
      }),
    ).toBe(1);

    verifyClerk.listAcceptedInvitationsForUser.mockResolvedValue([{
      id: `external_${invitationId}`,
      organizationId: externalOrganizationId,
      emailAddress: 'retry-family@example.test',
      role: 'org:member',
      publicMetadata: { oasis_invitation_id: invitationId },
      privateMetadata: { oasis_invitation_id: invitationId },
    }]);
    verifyClerk.getOrganizationMembership.mockResolvedValue({
      id: 'orgmem_old_revoked_invitation',
      organizationId: externalOrganizationId,
      userId: familySubject,
      role: 'org:member',
    });
    const oldActivation = await gql(
      bearer(familySubject, false),
      `mutation Activate($input: InvitationActivationInputDTO!) {
        activateViewerOrganizationInvitation(input: $input) { status nextPath }
      }`,
      { input: { invitationId } },
    ).expect(200);
    expect(oldActivation.body.errors).toHaveLength(1);
  });

  it('allows exactly one safe winner when invitation acceptance races cancellation and reissue', async () => {
    const input = {
      careRoomId: roomId,
      fullName: 'Race Relative',
      email: 'race-family@example.test',
      role: 'FAMILY_VIEWER',
      accessBasis: 'CLIENT_CONSENT',
    };
    const invited = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteFamilyContactInput!) {
        inviteFamilyContact(input: $input) { id invitationId accessGrants { scope } }
      }`,
      { input },
    ).expect(200);
    expect(invited.body.errors).toBeUndefined();
    expect(invited.body.data.inviteFamilyContact.accessGrants).toEqual([]);
    const invitationId = invited.body.data.inviteFamilyContact.invitationId;

    verifyClerk.listAcceptedInvitationsForUser.mockResolvedValue([{
      id: `external_${invitationId}`,
      organizationId: externalOrganizationId,
      emailAddress: input.email,
      role: 'org:member',
      publicMetadata: { oasis_invitation_id: invitationId },
      privateMetadata: { oasis_invitation_id: invitationId },
    }]);
    verifyClerk.getOrganizationMembership.mockResolvedValue({
      id: 'orgmem_family_race',
      organizationId: externalOrganizationId,
      userId: familySubject,
      role: 'org:member',
    });

    const [activation, cancellation] = await Promise.all([
      gql(
        bearer(familySubject, false),
        `mutation Activate($input: InvitationActivationInputDTO!) {
          activateViewerOrganizationInvitation(input: $input) { status nextPath }
        }`,
        { input: { invitationId } },
      ).expect(200),
      gql(
        bearer(adminSubject),
        `mutation Revoke($input: FamilyInvitationActionInput!) {
          revokeFamilyInvitation(input: $input) { status invitationStatus cleanupStatus }
        }`,
        { input: { invitationId } },
      ).expect(200),
    ]);

    expect([activation, cancellation].filter((result) => !result.body.errors)).toHaveLength(1);
    const terminal = await prisma.organizationMembershipInvitation.findUniqueOrThrow({
      where: { id: invitationId },
      include: {
        care_room_memberships: {
          include: { access_grants: { where: { revoked_at: null } } },
        },
      },
    });
    expect(terminal.status).toMatch(/^(ACCEPTED|REVOKED)$/);
    expect(terminal.care_room_memberships).toHaveLength(1);
    expect(terminal.care_room_memberships[0].access_grants).toEqual([]);

    const reissue = await gql(
      bearer(adminSubject),
      `mutation Invite($input: InviteFamilyContactInput!) {
        inviteFamilyContact(input: $input) { id invitationId status accessGrants { scope } }
      }`,
      { input },
    ).expect(200);
    if (terminal.status === 'REVOKED') {
      expect(reissue.body.errors).toBeUndefined();
      expect(reissue.body.data.inviteFamilyContact).toMatchObject({
        id: invited.body.data.inviteFamilyContact.id,
        status: 'INVITED',
        accessGrants: [],
      });
      expect(reissue.body.data.inviteFamilyContact.invitationId).not.toBe(invitationId);
    } else {
      expect(reissue.body.errors).toHaveLength(1);
      expect(await prisma.organizationMembershipInvitation.count({
        where: { normalized_email: input.email },
      })).toBe(1);
    }
    expect(await prisma.familyContact.count({ where: { email: input.email } })).toBe(1);
    expect(await prisma.careRoomMembership.count({
      where: { family_contact: { email: input.email } },
    })).toBe(1);
  });

  it('retries committed, expired-lease, and manual-review deliveries', async () => {
    const invitationId = 'family_invitation_committed_pending_delivery';
    const contact = await prisma.familyContact.create({
      data: {
        organization_id: organizationId,
        full_name: 'Committed Relative',
        email: 'committed-family@example.test',
        identity_type: 'clerk',
      },
    });
    await prisma.organizationMembershipInvitation.create({
      data: {
        id: invitationId,
        organization_id: organizationId,
        identity_provider: 'clerk',
        intended_email: 'committed-family@example.test',
        normalized_email: 'committed-family@example.test',
        intended_role: 'family',
        created_by_subject: adminSubject,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await prisma.careRoomMembership.create({
      data: {
        care_room_id: roomId,
        family_contact_id: contact.id,
        organization_membership_invitation_id: invitationId,
        role: 'FAMILY_VIEWER',
        access_basis: 'CLIENT_CONSENT',
        status: 'INVITED',
        invited_by_user_id: adminSubject,
      },
    });
    await prisma.organizationProvisioningOutbox.create({
      data: {
        id: 'family_outbox_committed_pending_delivery',
        organization_id: organizationId,
        invitation_id: invitationId,
        status: 'PENDING',
      },
    });

    const retried = await gql(
      bearer(adminSubject),
      `mutation Retry($input: FamilyInvitationActionInput!) {
        retryFamilyInvitationDelivery(input: $input) { deliveryStatus invitationStatus }
      }`,
      { input: { invitationId } },
    ).expect(200);

    expect(retried.body.errors).toBeUndefined();
    expect(retried.body.data.retryFamilyInvitationDelivery).toEqual({
      deliveryStatus: 'DELIVERED',
      invitationStatus: 'PENDING',
    });
    expect(adminClerk.ensureOrganizationInvitation).toHaveBeenCalledTimes(1);
    await expect(
      prisma.organizationProvisioningOutbox.findUniqueOrThrow({
        where: { invitation_id: invitationId },
      }),
    ).resolves.toMatchObject({ status: 'DELIVERED', attempt_count: 1 });

    await prisma.organizationMembershipInvitation.update({
      where: { id: invitationId },
      data: { external_invitation_id: null },
    });
    await prisma.organizationProvisioningOutbox.update({
      where: { invitation_id: invitationId },
      data: {
        status: 'PROCESSING',
        delivered_at: null,
        lease_token: 'expired-family-delivery-lease',
        lease_expires_at: new Date(Date.now() - 60_000),
      },
    });
    adminClerk.ensureOrganizationInvitation.mockClear();

    const recovered = await gql(
      bearer(adminSubject),
      `mutation Retry($input: FamilyInvitationActionInput!) {
        retryFamilyInvitationDelivery(input: $input) { deliveryStatus invitationStatus }
      }`,
      { input: { invitationId } },
    ).expect(200);

    expect(recovered.body.errors).toBeUndefined();
    expect(recovered.body.data.retryFamilyInvitationDelivery).toEqual({
      deliveryStatus: 'DELIVERED',
      invitationStatus: 'PENDING',
    });
    expect(adminClerk.ensureOrganizationInvitation).toHaveBeenCalledTimes(1);
    await expect(
      prisma.organizationProvisioningOutbox.findUniqueOrThrow({
        where: { invitation_id: invitationId },
      }),
    ).resolves.toMatchObject({ status: 'DELIVERED', attempt_count: 2 });

    await prisma.organizationMembershipInvitation.update({
      where: { id: invitationId },
      data: { external_invitation_id: null },
    });
    await prisma.organizationProvisioningOutbox.update({
      where: { invitation_id: invitationId },
      data: {
        status: 'NEEDS_ATTENTION',
        delivered_at: null,
        lease_token: null,
        lease_expires_at: null,
        last_error_code: 'CLERK_ORGANIZATION_NOT_BOUND',
      },
    });
    adminClerk.ensureOrganizationInvitation.mockClear();

    const manuallyRecovered = await gql(
      bearer(adminSubject),
      `mutation Retry($input: FamilyInvitationActionInput!) {
        retryFamilyInvitationDelivery(input: $input) { deliveryStatus invitationStatus }
      }`,
      { input: { invitationId } },
    ).expect(200);

    expect(manuallyRecovered.body.errors).toBeUndefined();
    expect(manuallyRecovered.body.data.retryFamilyInvitationDelivery).toEqual({
      deliveryStatus: 'DELIVERED',
      invitationStatus: 'PENDING',
    });
    expect(adminClerk.ensureOrganizationInvitation).toHaveBeenCalledTimes(1);
    await expect(
      prisma.organizationProvisioningOutbox.findUniqueOrThrow({
        where: { invitation_id: invitationId },
      }),
    ).resolves.toMatchObject({
      status: 'DELIVERED',
      attempt_count: 3,
      last_error_code: null,
    });

    await prisma.organizationMembershipInvitation.update({
      where: { id: invitationId },
      data: {
        created_at: new Date(Date.now() - 120_000),
        expires_at: new Date(Date.now() - 60_000),
      },
    });
    await prisma.organizationProvisioningOutbox.update({
      where: { invitation_id: invitationId },
      data: {
        status: 'PENDING',
        delivered_at: null,
        lease_token: null,
        lease_expires_at: null,
      },
    });
    adminClerk.ensureOrganizationInvitation.mockClear();

    const expiredRetry = await gql(
      bearer(adminSubject),
      `mutation Retry($input: FamilyInvitationActionInput!) {
        retryFamilyInvitationDelivery(input: $input) { deliveryStatus invitationStatus }
      }`,
      { input: { invitationId } },
    ).expect(200);

    expect(expiredRetry.body.errors).toHaveLength(1);
    expect(adminClerk.ensureOrganizationInvitation).not.toHaveBeenCalled();
    await expect(
      prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      }),
    ).resolves.toMatchObject({ status: 'EXPIRED', expired_at: expect.any(Date) });
    await expect(
      prisma.careRoomMembership.findFirstOrThrow({
        where: { organization_membership_invitation_id: invitationId },
      }),
    ).resolves.toMatchObject({ status: 'EXPIRED' });

    await prisma.organizationMembershipInvitation.update({
      where: { id: invitationId },
      data: {
        external_cleanup_required: false,
        external_cleanup_error_code: null,
        external_cleanup_completed_at: null,
      },
    });
    adminClerk.revokeOrganizationInvitationByInternalId.mockClear();
    const terminalRetry = await gql(
      bearer(adminSubject),
      `mutation Retry($input: FamilyInvitationActionInput!) {
        retryFamilyInvitationDelivery(input: $input) { deliveryStatus invitationStatus }
      }`,
      { input: { invitationId } },
    ).expect(200);
    expect(terminalRetry.body.errors).toHaveLength(1);
    expect(adminClerk.revokeOrganizationInvitationByInternalId).toHaveBeenCalledWith({
      externalOrganizationId,
      invitationId,
      emailAddress: 'committed-family@example.test',
      intendedRole: 'family',
    });
    await expect(
      prisma.organizationMembershipInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      }),
    ).resolves.toMatchObject({
      status: 'EXPIRED',
      external_cleanup_required: false,
      external_cleanup_error_code: null,
      external_cleanup_completed_at: expect.any(Date),
    });
  });
});
