import assert from "node:assert/strict";
import test from "node:test";
import {
  getHeaderHomePath,
  getHeaderNavigation,
  isHeaderNavigationItemActive,
} from "./headerNavigation";
import { createHeaderViewer } from "./headerIdentity";

const frontlineCapabilities = [
  "PROFILE_HELP_VIEW",
  "FRONTLINE_ASSIGNED_VISITS_VIEW",
  "FRONTLINE_SHIFT_VIEW",
] as const;

test("admin navigation exposes the seven required operational destinations in order", () => {
  const items = getHeaderNavigation("admin", "/admin/carers");
  assert.deepEqual(
    items.map((item) => item.label),
    [
      "Today",
      "People",
      "Schedule",
      "Workforce",
      "Family updates",
      "Reports",
      "Settings",
    ],
  );
  assert.equal(
    items.find((item) => item.label === "Workforce")?.href,
    "/admin/carers",
  );
  assert.equal(isHeaderNavigationItemActive("/admin/carers", items[3]), true);
});

test("carer and family navigation never inherit admin destinations", () => {
  const forbidden = new Set([
    "People",
    "Schedule",
    "Workforce",
    "Family updates",
    "Reports",
  ]);
  for (const surface of ["staff", "family"] as const) {
    const labels = getHeaderNavigation(
      surface,
      surface === "staff" ? "/today" : "/family",
      surface === "staff" ? frontlineCapabilities : [],
    ).map((item) => item.label);
    assert.equal(
      labels.some((label) => forbidden.has(label)),
      false,
    );
  }

  assert.deepEqual(
    getHeaderNavigation("staff", "/today", frontlineCapabilities).map((item) => item.label),
    ["Today", "My visits", "My shift", "Profile/help"],
  );
  assert.deepEqual(
    getHeaderNavigation("family", "/family").map((item) => item.label),
    ["Home", "Updates", "Latest update", "Concerns/help"],
  );
});

test("current visit navigation appears only inside a concrete visit workspace", () => {
  assert.equal(
    getHeaderNavigation("staff", "/visits", frontlineCapabilities).some(
      (item) => item.label === "Current visit",
    ),
    false,
  );
  const items = getHeaderNavigation("staff", "/visits/visit-123", frontlineCapabilities);
  assert.equal(
    items.find((item) => item.label === "Current visit")?.href,
    "/visits/visit-123",
  );
  const scheduledItems = getHeaderNavigation("staff", "/schedule/visit-123", frontlineCapabilities);
  assert.equal(
    scheduledItems.find((item) => item.label === "Current visit")?.href,
    "/schedule/visit-123",
  );
  assert.deepEqual(
    scheduledItems
      .filter((item) =>
        isHeaderNavigationItemActive("/schedule/visit-123", item),
      )
      .map((item) => item.label),
    ["Current visit"],
  );
  assert.equal(
    getHeaderNavigation("staff", "/schedule/new", frontlineCapabilities).some(
      (item) => item.label === "Current visit",
    ),
    false,
  );
});

test("family hash destinations do not all announce themselves as current", () => {
  const landingItems = getHeaderNavigation("family", "/family");
  assert.deepEqual(
    landingItems
      .filter((item) => isHeaderNavigationItemActive("/family", item))
      .map((item) => item.label),
    ["Home"],
  );

  const roomItems = getHeaderNavigation("family", "/family/care-rooms/room-1");
  const updates = roomItems.find((item) => item.label === "Updates");
  assert.ok(updates);
  assert.equal(
    isHeaderNavigationItemActive("/family/care-rooms/room-1", updates),
    true,
  );
});

test("unsupported management roles receive no admin or Carer action links", () => {
  const viewer = createHeaderViewer({
    pathname: "/settings",
    status: "authenticated",
    roles: ["manager", "carer"],
    capabilities: ["PROFILE_HELP_VIEW", "AI_SUMMARY_REVIEW", "GDPR_MANAGE"],
    userName: "Workforce Manager",
    userEmail: "manager@example.test",
  });
  const surface =
    viewer.accessContext.homePath === "/settings"
      ? "management"
      : viewer.accessContext.surface;
  assert.equal(surface, "management");
  assert.deepEqual(
    getHeaderNavigation(surface, "/settings").map((item) => item.label),
    ["Settings"],
  );
  assert.equal(
    getHeaderHomePath(surface, viewer.accessContext.homePath),
    "/settings",
  );
});

test("supported role home links retain their authoritative destinations", () => {
  assert.equal(getHeaderHomePath("admin", "/today"), "/today");
  assert.equal(getHeaderHomePath("staff", "/today"), "/today");
  assert.equal(getHeaderHomePath("family", "/family"), "/family");
});

test("a management identity with explicit frontline access receives the frontline header", () => {
  const viewer = createHeaderViewer({
    pathname: "/today",
    status: "authenticated",
    roles: ["manager", "carer"],
    capabilities: [
      "PROFILE_HELP_VIEW",
      "FRONTLINE_ASSIGNED_VISITS_VIEW",
    ],
  });
  assert.equal(viewer.accessContext.homePath, "/today");
  assert.deepEqual(
    getHeaderNavigation(
      viewer.accessContext.surface,
      "/today",
      viewer.accessContext.capabilities,
    ).map(
      (item) => item.label,
    ),
    ["Today", "My visits", "Profile/help"],
  );
});
