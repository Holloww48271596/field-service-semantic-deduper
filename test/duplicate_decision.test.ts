import assert from "node:assert/strict";
import test from "node:test";
import { decideDuplicate } from "../src/duplicate_decision.js";
import type { FieldRecord } from "../src/field_record.js";

const incoming: FieldRecord = {
  workOrderId: "wo-2048",
  photo: { caption: "Water below the inlet valve" },
  dispatchStatus: "on_site",
  technicianFollowUp: "Changed washer and observed the joint.",
  occurredAt: "2026-09-12T08:30:00.000Z"
};

test("flags a semantically close active dispatch as a duplicate", () => {
  const decision = decideDuplicate(incoming, [{
    id: "wo-2039",
    score: 0.93,
    metadata: { dispatchStatus: "en_route" }
  }]);

  assert.deepEqual(decision, {
    outcome: "duplicate",
    matchedWorkOrderId: "wo-2039",
    similarity: 0.93,
    reason: "the field note is semantically close and the dispatch states agree"
  });
});

test("stores a similar note when the earlier dispatch is completed", () => {
  const decision = decideDuplicate(incoming, [{
    id: "wo-1901",
    score: 0.95,
    metadata: { dispatchStatus: "completed" }
  }]);

  assert.equal(decision.outcome, "stored");
});
