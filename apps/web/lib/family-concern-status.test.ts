import assert from "node:assert/strict";
import test from "node:test";
import {
  familyConcernEventLabel,
  familyConcernStatusLabel,
} from "./family-concern-status";

test("maps every supported concern status without inventing a received state", () => {
  assert.equal(familyConcernStatusLabel("OPEN"), "Sent");
  assert.equal(familyConcernStatusLabel("ACKNOWLEDGED"), "Acknowledged");
  assert.equal(familyConcernStatusLabel("IN_PROGRESS"), "Being reviewed");
  assert.equal(familyConcernStatusLabel("ESCALATED"), "Escalated for review");
  assert.equal(familyConcernStatusLabel("RESOLVED"), "Resolved");
  assert.equal(familyConcernStatusLabel("CLOSED"), "Closed");
  assert.notEqual(familyConcernStatusLabel("OPEN"), "Received");
});

test("uses safe event labels and stable unknown fallbacks", () => {
  assert.equal(familyConcernEventLabel("RESPONDED"), "Status updated");
  assert.equal(familyConcernEventLabel("ASSIGNED"), "Status updated");
  assert.equal(familyConcernStatusLabel("FUTURE_STATUS"), "Status unavailable");
});
