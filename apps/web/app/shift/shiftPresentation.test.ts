import assert from "node:assert/strict";
import test from "node:test";
import {
  shiftVerificationLabel,
  todayShiftAction,
} from "./shiftPresentation";

test("uses human shift verification labels", () => {
  assert.equal(shiftVerificationLabel("GPS"), "Location recorded");
  assert.equal(shiftVerificationLabel("MANUAL"), "Manual check");
  assert.equal(shiftVerificationLabel("QR"), "QR code");
  assert.equal(shiftVerificationLabel("NFC"), "NFC");
  assert.equal(shiftVerificationLabel("PHONE"), "Phone check");
});

test("Today names the next valid shift action", () => {
  assert.equal(
    todayShiftAction({ active: false, unavailable: false }),
    "Clock in",
  );
  assert.equal(
    todayShiftAction({ active: true, unavailable: false }),
    "Manage active shift",
  );
  assert.equal(
    todayShiftAction({ active: false, unavailable: true }),
    "Try shift status again",
  );
});
