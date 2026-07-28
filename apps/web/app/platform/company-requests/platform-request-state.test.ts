import assert from "node:assert/strict";
import test from "node:test";
import { GraphQLRequestError } from "../../../lib/graphql/client";
import { classifyPlatformRequestFailure } from "./platform-request-state";

test("classifies only the stable GraphQL FORBIDDEN code as denied", () => {
  assert.equal(
    classifyPlatformRequestFailure(
      new GraphQLRequestError("internal guard wording", "FORBIDDEN"),
    ),
    "forbidden",
  );
  assert.equal(
    classifyPlatformRequestFailure(
      new GraphQLRequestError("internal guard wording", "forbidden"),
    ),
    "forbidden",
  );
});

test("treats missing, unknown, and transport failures as unavailable", () => {
  assert.equal(
    classifyPlatformRequestFailure(
      new GraphQLRequestError("sensitive upstream detail", null),
    ),
    "unavailable",
  );
  assert.equal(
    classifyPlatformRequestFailure(
      new GraphQLRequestError("sensitive upstream detail", "INTERNAL_ERROR"),
    ),
    "unavailable",
  );
  assert.equal(
    classifyPlatformRequestFailure(new Error("transport failed")),
    "unavailable",
  );
});
