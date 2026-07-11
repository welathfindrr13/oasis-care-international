import assert from "node:assert/strict";
import test from "node:test";
import {
  getHeaderNavigation,
  getHeaderSurfaceForViewer,
  isHeaderNavigationItemActive,
} from "./headerNavigation";
import { createHeaderViewer } from "./headerIdentity";

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
    ).map((item) => item.label);
    assert.equal(
      labels.some((label) => forbidden.has(label)),
      false,
    );
  }

  assert.deepEqual(
    getHeaderNavigation("staff", "/today").map((item) => item.label),
    ["Today", "My visits", "My shift", "Profile/help"],
  );
  assert.deepEqual(
    getHeaderNavigation("family", "/family").map((item) => item.label),
    ["Home", "Care rooms", "Updates", "Concerns/help"],
  );
});

test("current visit navigation appears only inside a concrete visit workspace", () => {
  assert.equal(
    getHeaderNavigation("staff", "/visits").some(
      (item) => item.label === "Current visit",
    ),
    false,
  );
  const items = getHeaderNavigation("staff", "/visits/visit-123");
  assert.equal(
    items.find((item) => item.label === "Current visit")?.href,
    "/visits/visit-123",
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
  const careRooms = roomItems.find((item) => item.label === "Care rooms");
  assert.ok(careRooms);
  assert.equal(
    isHeaderNavigationItemActive("/family/care-rooms/room-1", careRooms),
    true,
  );
});

test("unsupported management roles receive no admin or Carer action links", () => {
  const viewer = createHeaderViewer({
    pathname: "/settings",
    status: "authenticated",
    roles: ["manager", "carer"],
    userName: "Workforce Manager",
    userEmail: "manager@example.test",
  });
  const surface = getHeaderSurfaceForViewer(
    viewer.accessContext.surface,
    viewer.roles,
  );
  assert.equal(surface, "management");
  assert.deepEqual(
    getHeaderNavigation(surface, "/settings").map((item) => item.label),
    ["Settings"],
  );
});
