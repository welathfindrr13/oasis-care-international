import http from "node:http";

const port = Number(process.env.ACCESSIBILITY_FIXTURE_API_PORT || 4014);
const visitId = "77777777-7777-4777-8777-777777777777";

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
  family: [
    "PROFILE_HELP_VIEW",
    "FAMILY_UPDATES_VIEW",
    "FAMILY_CONCERN_CREATE",
  ],
};

function readBearerPayload(request) {
  const token = String(request.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const encodedPayload = token.split(".")[1];
  if (!encodedPayload) return {};
  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
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
  };
}

function graphqlData(query, request) {
  if (query.includes("ViewerAccessSnapshot")) {
    return { viewerAccessSnapshot: accessSnapshot(request) };
  }
  if (query.includes("query Visits(")) {
    return { visits: { items: [], total: 0 } };
  }
  if (query.includes("query ShiftAnalytics")) {
    return {
      shiftAnalytics: {
        activeCarersNow: 0,
        openShiftCount: 0,
        clockIns: 0,
        clockOuts: 0,
        averageShiftMinutes: 0,
        clockInMethods: { gps: 0, qr: 0, nfc: 0, phone: 0, manual: 0 },
        clockOutMethods: { gps: 0, qr: 0, nfc: 0, phone: 0, manual: 0 },
      },
    };
  }
  if (query.includes("query CarerAccessLifecycle")) {
    return { carerAccessLifecycle: [] };
  }
  if (query.includes("query MyActiveShift")) {
    return { myActiveShift: null };
  }
  if (query.includes("query Visit(")) {
    return {
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
    };
  }
  if (query.includes("query CareLogs(")) {
    return { careLogs: { total: 0, items: [] } };
  }
  if (query.includes("query DueMeds(")) {
    return { listDueMeds: [] };
  }
  if (query.includes("query FamilyCareRooms")) {
    return { familyCareRooms: [] };
  }
  if (query.includes("query FamilyVerifiedVisitStories")) {
    return { familyVerifiedVisitStories: [] };
  }
  if (query.includes("query CarebridgeConcernInbox")) {
    return { carebridgeConcernInbox: [] };
  }
  return null;
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
    const query = String(payload.query || "");
    const data = graphqlData(query, request);
    if (!data) {
      const operation = query.match(/(?:query|mutation)\s+(\w+)/)?.[1] || "unknown";
      sendJson(response, 400, {
        errors: [{ message: `Unsupported accessibility fixture operation: ${operation}` }],
      });
      return;
    }
    sendJson(response, 200, { data });
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Accessibility fixture API listening on ${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
