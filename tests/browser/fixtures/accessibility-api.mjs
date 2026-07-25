import http from "node:http";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const requireFromApiWorkspace = createRequire(
  new URL("../../../apps/api/package.json", import.meta.url),
);
const { Kind, parse } = requireFromApiWorkspace("graphql");

const port = Number(process.env.ACCESSIBILITY_FIXTURE_API_PORT || 4014);
const visitId = "77777777-7777-4777-8777-777777777777";
const personId = "88888888-8888-4888-8888-888888888888";
const careRoomId = "99999999-9999-4999-8999-999999999999";
const emptyConcernRoomId = "13131313-1313-4131-8131-131313131313";
const unavailableConcernRoomId = "14141414-1414-4141-8141-141414141414";
const revokedConcernRoomId = "15151515-1515-4151-8151-151515151515";
const zeroGrantConcernRoomId = "16161616-1616-4161-8161-161616161616";
const companyRequestId = "10101010-1010-4010-8010-101010101010";

class GraphQLFixtureError extends Error {}

const capabilities = {
  admin: [
    "PROFILE_HELP_VIEW",
    "TENANT_ADMIN",
    "PEOPLE_MANAGE",
    "WORKFORCE_MANAGE",
    "SCHEDULE_MANAGE",
    "FAMILY_ACCESS_MANAGE",
    "OPERATIONAL_REPORTS_VIEW",
  ],
  carer: [
    "PROFILE_HELP_VIEW",
    "FRONTLINE_SHIFT_VIEW",
    "FRONTLINE_SHIFT_EXECUTE",
    "FRONTLINE_ASSIGNED_VISITS_VIEW",
    "FRONTLINE_VISIT_EXECUTE",
  ],
  family: ["PROFILE_HELP_VIEW", "FAMILY_UPDATES_VIEW", "FAMILY_CONCERN_CREATE"],
};

function readBearerPayload(request) {
  const token = String(request.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const encodedPayload = token.split(".")[1];
  if (!encodedPayload) return {};
  try {
    return JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    return {};
  }
}

function accessSnapshot(request) {
  const payload = readBearerPayload(request);
  const tokenRole = String(payload.role || "").toLowerCase();
  if (tokenRole === "admin") {
    return {
      authenticated: true,
      organizationId: "org-accessibility-fixture",
      effectiveRole: "admin",
      membershipState: "ACTIVE",
      surface: "ADMIN",
      linkedIdentityState: "NOT_REQUIRED",
      onboardingState: "READY",
      capabilities: capabilities.admin,
      medicationEmarEnabled: false,
    };
  }
  if (tokenRole === "carer") {
    return {
      authenticated: true,
      organizationId: "org-accessibility-fixture",
      effectiveRole: "carer",
      membershipState: "ACTIVE",
      surface: "STAFF",
      linkedIdentityState: "LINKED",
      onboardingState: "READY",
      capabilities: capabilities.carer,
      medicationEmarEnabled: false,
    };
  }
  if (tokenRole === "user") {
    return {
      authenticated: true,
      organizationId: "org-accessibility-fixture",
      effectiveRole: "family",
      membershipState: "ACTIVE",
      surface: "FAMILY",
      linkedIdentityState: "LINKED",
      onboardingState: "READY",
      capabilities: capabilities.family,
      medicationEmarEnabled: false,
    };
  }
  return {
    authenticated: false,
    organizationId: null,
    effectiveRole: null,
    membershipState: "MISSING",
    surface: "NONE",
    linkedIdentityState: "NOT_REQUIRED",
    onboardingState: "NOT_STARTED",
    capabilities: [],
    medicationEmarEnabled: false,
  };
}

const operationHandlers = new Map([
  [
    "ViewerAccessSnapshot",
    (request) => ({ viewerAccessSnapshot: accessSnapshot(request) }),
  ],
  ["Visits", () => ({ visits: { items: [], total: 0 } })],
  [
    "Client",
    () => ({
      client: {
        id: personId,
        fullName: "Jordan Ellis",
        addressLine1: "12 Test Lane",
        addressLine2: null,
        city: "Leeds",
        postcode: "LS1 1AA",
      },
    }),
  ],
  [
    "CareRooms",
    () => ({
      careRooms: [
        {
          id: careRoomId,
          status: "ACTIVE",
          client: { id: personId, fullName: "Jordan Ellis" },
          memberships: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              invitationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              role: "FAMILY_VIEWER",
              status: "INVITED",
              accessBasis: "CLIENT_CONSENT",
              reviewDueAt: null,
              familyContact: {
                id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                fullName: "Alex Ellis",
                email: "alex@example.test",
                relationship: "Daughter",
              },
              accessGrants: [],
              invitationStatus: "PENDING",
              deliveryStatus: "DELIVERED",
              cleanupStatus: "COMPLETE",
              invitationExpiresAt: "2026-07-25T09:00:00.000Z",
            },
            {
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              invitationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              role: "FAMILY_VIEWER",
              status: "ACTIVE",
              accessBasis: "PROVIDER_AUTHORISED",
              reviewDueAt: null,
              familyContact: {
                id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
                fullName: "Morgan Ellis",
                email: "morgan@example.test",
                relationship: "Son",
              },
              accessGrants: [
                {
                  id: "grant-update",
                  scope: "VIEW_UPDATES",
                  grantedAt: "2026-07-18T09:00:00.000Z",
                  revokedAt: null,
                },
                {
                  id: "grant-summary",
                  scope: "VIEW_TASK_SUMMARY",
                  grantedAt: "2026-07-18T09:00:00.000Z",
                  revokedAt: null,
                },
              ],
              invitationStatus: "ACCEPTED",
              deliveryStatus: "DELIVERED",
              cleanupStatus: "COMPLETE",
              invitationExpiresAt: "2026-07-25T09:00:00.000Z",
            },
          ],
          policy: null,
          createdAt: "2026-07-18T09:00:00.000Z",
          updatedAt: "2026-07-18T09:00:00.000Z",
        },
      ],
    }),
  ],
  ["VerifiedVisitStories", () => ({ verifiedVisitStories: [] })],
  [
    "OrganizationSetupDetails",
    () => ({
      viewerOrganizationSetupDetails: { name: "Meadow Care Services" },
    }),
  ],
  [
    "CompanyRequests",
    (_request, payload) => {
      const status = payload.variables?.status;
      const isDisabled = status === "DISABLED";
      const isApproved = status === "APPROVED";
      const items =
        isDisabled || isApproved
          ? [
              {
                id: companyRequestId,
                companyName: "Meadow Care Services",
                contactName: "Avery Morgan",
                businessEmail: "avery@example.test",
                operationalNote: null,
                status,
                organizationId: "org-accessibility-fixture",
                provisioningStatus: "ACTIVATED",
                provisioningAttemptCount: 1,
                provisioningErrorCode: null,
                bootstrapManagerEmail: "manager@example.test",
                bootstrapManagerAccessStatus: isDisabled ? "REVOKED" : "ACTIVE",
                bootstrapManagerCleanupStatus: isDisabled
                  ? "NEEDS_ATTENTION"
                  : "NOT_REQUIRED",
                bootstrapManagerCleanupErrorCode: isDisabled
                  ? "CLERK_MEMBERSHIP_BINDING_MISMATCH"
                  : null,
                requestedAt: "2026-07-18T09:00:00.000Z",
              },
            ]
          : [];
      return {
        companyAccessRequests: {
          items,
          total: items.length,
          offset: 0,
          limit: 50,
        },
      };
    },
  ],
  [
    "ShiftAnalytics",
    () => ({
      shiftAnalytics: {
        activeCarersNow: 0,
        openShiftCount: 0,
        clockIns: 0,
        clockOuts: 0,
        averageShiftMinutes: 0,
        clockInMethods: { gps: 0, qr: 0, nfc: 0, phone: 0, manual: 0 },
        clockOutMethods: { gps: 0, qr: 0, nfc: 0, phone: 0, manual: 0 },
      },
    }),
  ],
  ["CarerAccessLifecycle", () => ({ carerAccessLifecycle: [] })],
  ["MyActiveShift", () => ({ myActiveShift: null })],
  [
    "Visit",
    () => ({
      visit: {
        id: visitId,
        clientId: "person-accessibility-fixture",
        carerId: "carer-accessibility-fixture",
        scheduledStart: "2026-07-13T09:00:00.000Z",
        scheduledEnd: "2026-07-13T10:00:00.000Z",
        actualStart: null,
        actualEnd: null,
        status: "SCHEDULED",
        notes: null,
        client: {
          id: "person-accessibility-fixture",
          fullName: "Jordan Ellis",
          addressLine1: "12 Test Lane",
          addressLine2: null,
          city: "Leeds",
          postcode: "LS1 1AA",
        },
        carer: {
          id: "carer-accessibility-fixture",
          firstName: "Sam",
          lastName: "Taylor",
          email: "carer@local.dev",
          phone: null,
        },
        tasks: [
          {
            id: "task-accessibility-fixture",
            taskName: "Confirm visit plan",
            description: "Synthetic browser fixture task",
            isCompleted: false,
            completedAt: null,
            notes: null,
          },
        ],
      },
    }),
  ],
  ["CareLogs", () => ({ careLogs: { total: 0, items: [] } })],
  ["FamilyCareRooms", () => ({ familyCareRooms: [] })],
  [
    "FamilyCareRoom",
    (_request, payload) => {
      const requestedRoomId = payload.variables?.id;
      if (requestedRoomId === revokedConcernRoomId) {
        throw new GraphQLFixtureError(
          "You do not have access to this CareBridge room.",
        );
      }
      return {
      familyCareRoom: {
        id: requestedRoomId || careRoomId,
        clientDisplayName: "Jordan Ellis",
        canViewApprovedUpdates: true,
        canRaiseConcerns: requestedRoomId !== zeroGrantConcernRoomId,
      },
      };
    },
  ],
  ["FamilyVerifiedVisitStories", () => ({ familyVerifiedVisitStories: [] })],
  [
    "FamilyCareRoomConcerns",
    (_request, payload) => {
      const requestedRoomId = payload.variables?.careRoomId;
      if (requestedRoomId === unavailableConcernRoomId) {
        throw new Error("Synthetic concern status unavailable");
      }
      if (requestedRoomId === emptyConcernRoomId) {
        return { familyCareRoomConcerns: [] };
      }
      return {
      familyCareRoomConcerns: [
        {
          id: "12121212-1212-4121-8121-121212121212",
          title:
            "Please review this clearly fictional family concern with a deliberately long title",
          status: "ACKNOWLEDGED",
          submittedAt: "2026-07-24T09:00:00.000Z",
          events: [
            {
              eventType: "RAISED",
              createdAt: "2026-07-24T09:00:00.000Z",
            },
            {
              eventType: "ACKNOWLEDGED",
              createdAt: "2026-07-24T09:30:00.000Z",
            },
          ],
        },
      ],
      };
    },
  ],
  ["CarebridgeConcernInbox", () => ({ carebridgeConcernInbox: [] })],
]);

export function parseAllowedOperation(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.query !== "string"
  ) {
    throw new Error("GraphQL request must include a query string");
  }

  let document;
  try {
    document = parse(payload.query);
  } catch {
    throw new Error("GraphQL request could not be parsed");
  }

  const operations = document.definitions.filter(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  );
  if (operations.length !== 1) {
    throw new Error("GraphQL request must contain exactly one operation");
  }

  const [operation] = operations;
  const operationName = operation.name?.value;
  if (operation.operation !== "query" || !operationName) {
    throw new Error("GraphQL request must contain one named query");
  }
  if (payload.operationName && payload.operationName !== operationName) {
    throw new Error("GraphQL operationName does not match the parsed query");
  }
  if (!operationHandlers.has(operationName)) {
    throw new Error(
      `Unsupported accessibility fixture operation: ${operationName}`,
    );
  }
  return operationName;
}

export function graphqlData(payload, request) {
  const operationName = parseAllowedOperation(payload);
  return operationHandlers.get(operationName)(request, payload);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/graphql") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      sendJson(response, 400, { errors: [{ message: "Invalid JSON" }] });
      return;
    }
    let data;
    try {
      data = graphqlData(payload, request);
    } catch (error) {
      sendJson(response, error instanceof GraphQLFixtureError ? 200 : 400, {
        errors: [
          {
            message:
              error instanceof Error
                ? error.message
                : "Unsupported accessibility fixture operation",
          },
        ],
      });
      return;
    }
    sendJson(response, 200, { data });
  });
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`Accessibility fixture API listening on ${port}\n`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
