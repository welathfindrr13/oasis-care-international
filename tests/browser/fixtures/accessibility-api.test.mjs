import assert from "node:assert/strict";
import test from "node:test";
import {
  graphqlData,
  parseAllowedOperation,
} from "./accessibility-api.mjs";

const request = { headers: { authorization: "" } };

test("returns fixture data only for an exact allowlisted parsed operation name", () => {
  assert.deepEqual(
    graphqlData({ query: "query Visits { visits { total } }" }, request),
    { visits: { items: [], total: 0 } },
  );
  assert.equal(
    parseAllowedOperation({
      query: "query FamilyCareRooms { familyCareRooms { id } }",
      operationName: "FamilyCareRooms",
    }),
    "FamilyCareRooms",
  );
});

test("does not allow operation-name substrings or query text inside string values", () => {
  assert.throws(
    () =>
      parseAllowedOperation({
        query: 'query VisitsExtended { unsupported(value: "query Visits(") }',
      }),
    /Unsupported accessibility fixture operation: VisitsExtended/,
  );
});

test("fails malformed and anonymous GraphQL requests closed", () => {
  assert.throws(
    () => parseAllowedOperation({ query: "query Visits {" }),
    /could not be parsed/,
  );
  assert.throws(
    () => parseAllowedOperation({ query: "{ visits { total } }" }),
    /one named query/,
  );
});

test("rejects mutations, multiple operations and mismatched operationName values", () => {
  assert.throws(
    () => parseAllowedOperation({ query: "mutation Visits { unsupported }" }),
    /one named query/,
  );
  assert.throws(
    () =>
      parseAllowedOperation({
        query: "query Visits { visits { total } } query DueMeds { listDueMeds { id } }",
      }),
    /exactly one operation/,
  );
  assert.throws(
    () =>
      parseAllowedOperation({
        query: "query Visits { visits { total } }",
        operationName: "DueMeds",
      }),
    /does not match/,
  );
});
