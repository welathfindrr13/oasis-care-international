import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const clientList = read("./clients/page.tsx");
const clientDetails = read("./clients/[id]/page.tsx");
const clientCreate = read("./clients/new/page.tsx");
const clientEdit = read("./clients/[id]/edit/page.tsx");
const setup = read("./admin/setup/page.tsx");
const settings = read("./settings/page.tsx");
const carePlanning = read("./care-planning/page.tsx");
const evidence = read("./evidence/page.tsx");
const metrics = read("./admin/metrics/page.tsx");
const peopleAlias = read("./people/page.tsx");
const reportsAlias = read("./reports/page.tsx");

test("Manager client surfaces use one operational vocabulary without internal identifiers", () => {
  assert.match(clientList, /Clients supported/);
  assert.match(clientList, /Add client/);
  assert.match(clientList, /Search clients/);
  assert.doesNotMatch(clientList, /ID:|client\.id\.slice/);

  assert.match(clientDetails, /Client details/);
  assert.doesNotMatch(clientDetails, /source record|Person profile/);
  assert.match(clientCreate, /Add client/);
  assert.match(clientCreate, /Create client/);
  assert.match(clientEdit, /Edit client/);
  assert.match(setup, /Add a client/);
  assert.match(setup, /View clients/);
});

test("client directory renders each client once in one responsive table", () => {
  assert.equal(clientList.match(/clients\.map\(/g)?.length, 1);
  assert.match(clientList, /className="block w-full md:table"/);
  assert.match(clientList, /className="hidden md:table-header-group"/);
  assert.doesNotMatch(clientList, /className="grid gap-4 md:hidden"/);
});

test("client actions preserve exact context without fake or global tabs", () => {
  for (const expected of [
    /\/schedule\?clientId=\$\{client\.id\}/,
    /\/clients\/\$\{client\.id\}\/carebridge/,
    /\/care-planning\?clientId=\$\{client\.id\}/,
    /\/evidence\?clientId=\$\{client\.id\}/,
  ]) {
    assert.match(clientDetails, expected);
  }
  assert.doesNotMatch(
    clientDetails,
    /label: 'Care Plan'|label: 'Assessments'|label: 'Risks'|label: 'Documents'/,
  );
});

test("compatible aliases remain while service monitoring stays separate", () => {
  assert.match(peopleAlias, /clients\/page/);
  assert.match(reportsAlias, /evidence\/page/);
  assert.match(settings, /Service monitoring/);
  assert.match(settings, /href="\/admin\/metrics"/);
  assert.match(metrics, /TENANT_ADMIN/);
});

test("care planning and inspection records check authority before loading clients", () => {
  for (const page of [carePlanning, evidence]) {
    const gate = page.search(
      /hasAccessCapability\(accessSnapshot\.capabilities,\s*["']TENANT_ADMIN["']\)/,
    );
    const query = page.indexOf("const clientsResult = await getClientsSafe()");
    assert.ok(gate > -1);
    assert.ok(query > gate);
  }
});

test("requested client context is fetched exactly and never falls back to another client", () => {
  for (const page of [carePlanning, evidence]) {
    assert.match(page, /CLIENT_CONTEXTS_QUERY/);
    assert.match(page, /CLIENT_CONTEXT_QUERY/);
    assert.doesNotMatch(page, /\bCLIENTS_QUERY\b/);
    assert.doesNotMatch(page, /\bCLIENT_QUERY\b/);
    assert.match(page, /getRequestedClientSafe\(requestedClientId\)/);
    assert.doesNotMatch(
      page,
      /clients\.find\([^)]*clientId[^)]*\)\s*\?\?\s*clients\[0\]/,
    );
    assert.match(page, /requestedClientUnavailable/);
    assert.match(
      page,
      /const requestedClientInvalid = Array\.isArray\(requestedClientParam\)/,
    );
  }
});

test("client-list or requested-client failure keeps every mutation and download surface closed", () => {
  assert.match(
    carePlanning,
    /\{selectedClient\s*&&\s*!clientsResult\.unavailable\s*&&\s*!requestedClientUnavailable\s*&&\s*!carePlanningUnavailable\s*\?\s*\([\s\S]*?<CarePlanningActions/,
  );
  assert.match(
    evidence,
    /\{selectedClient\s*&&\s*!clientsResult\.unavailable\s*&&\s*!requestedClientUnavailable\s*&&\s*!recordsUnavailable\s*\?\s*\([\s\S]*?<InspectionRecordList[\s\S]*?<InspectionRecordActions/,
  );
});

test("care planning and inspection records keep their actions separate", () => {
  assert.doesNotMatch(
    carePlanning,
    /InspectionRecordActions|Create inspection record|Evidence packs/,
  );
  assert.doesNotMatch(
    evidence,
    /CarePlanningActions|Create assessment|Activate care plan|Archive care plan/,
  );
  assert.match(carePlanning, /CarePlanningActions/);
  assert.match(evidence, /InspectionRecordActions/);
  assert.doesNotMatch(
    carePlanning + evidence,
    /proof-led|source-linked|bg-gradient/,
  );
});

test("client details return each role to an accessible directory", () => {
  assert.match(
    clientDetails,
    /const directoryHref = isAdmin \? '\/clients' : '\/people'/,
  );
  assert.match(
    clientDetails,
    /href=\{directoryHref\}>Back to \{entityLabelPlural\}/,
  );
  assert.match(
    clientDetails,
    /href=\{directoryHref\} className="text-slate-500/,
  );
});

test("client details do not advertise admin-only care notes to Carers", () => {
  assert.match(
    clientDetails,
    /isAdmin\s*\?\s*\[\s*\{ label: 'Care Notes', href: `\/clients\/\$\{client\.id\}\/care-logs` \}/,
  );
  assert.match(
    clientDetails,
    /\{isAdmin && \(\s*<>\s*<Button[\s\S]*?Care Notes/,
  );
});

test("partial visit and care-planning failures are unavailable, never empty", () => {
  assert.match(
    clientDetails,
    /const \{ visits: recentVisits, error: visitsError \}/,
  );
  assert.match(
    clientDetails,
    /const carePlanningError = carePlanningResult\?\.error/,
  );
  assert.match(
    clientDetails,
    /kind="unavailable"[\s\S]*title="Recent visits are unavailable"/,
  );
  assert.match(
    clientDetails,
    /kind="unavailable"[\s\S]*title="Next visit is unavailable"/,
  );
  assert.match(
    clientDetails,
    /kind="unavailable"[\s\S]*title="Inspection records are unavailable"/,
  );
  assert.match(
    clientDetails,
    /visitsError\s*\?\s*'Visit information unavailable'/,
  );
  assert.match(
    clientDetails,
    /carePlanningError\s*\?\s*'Assessment information unavailable'/,
  );
  assert.match(
    clientDetails,
    /carePlanningError\s*\?\s*'Care-plan information unavailable'/,
  );
  assert.match(
    clientDetails,
    /carePlanningError\s*\?\s*'Review information unavailable'/,
  );
});
