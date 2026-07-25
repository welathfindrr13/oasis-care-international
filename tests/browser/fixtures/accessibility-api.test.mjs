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
  assert.deepEqual(
    graphqlData(
      {
        query:
          "query FamilyCareRoomConcerns($careRoomId: String!) { familyCareRoomConcerns(careRoomId: $careRoomId) { id } }",
        variables: {
          careRoomId: "13131313-1313-4131-8131-131313131313",
        },
      },
      request,
    ),
    { familyCareRoomConcerns: [] },
  );
  assert.throws(
    () =>
      graphqlData(
        {
          query:
            "query FamilyCareRoomConcerns($careRoomId: String!) { familyCareRoomConcerns(careRoomId: $careRoomId) { id } }",
          variables: {
            careRoomId: "14141414-1414-4141-8141-141414141414",
          },
        },
        request,
      ),
    /Synthetic concern status unavailable/,
  );
  assert.equal(
    parseAllowedOperation({
      query: "query FamilyCareRooms { familyCareRooms { id } }",
      operationName: "FamilyCareRooms",
    }),
    "FamilyCareRooms",
  );
  assert.deepEqual(
    graphqlData(
      {
        query:
          "query FamilyCareRoomConcerns($careRoomId: String!) { familyCareRoomConcerns(careRoomId: $careRoomId) { id title status } }",
        variables: { careRoomId: "99999999-9999-4999-8999-999999999999" },
      },
      request,
    ).familyCareRoomConcerns.map(({ title, status }) => ({ title, status })),
    [
      {
        title:
          "Please review this clearly fictional family concern with a deliberately long title",
        status: "ACKNOWLEDGED",
      },
    ],
  );
  assert.deepEqual(
    graphqlData({ query: "query Client($id: String!) { client(id: $id) { id fullName } }" }, request),
    {
      client: {
        id: "88888888-8888-4888-8888-888888888888",
        fullName: "Jordan Ellis",
        addressLine1: "12 Test Lane",
        addressLine2: null,
        city: "Leeds",
        postcode: "LS1 1AA",
      },
    },
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
