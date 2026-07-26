import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(import.meta.dirname);

function source(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), "utf8");
}

const inspectionActions = source(
  "../components/evidence/InspectionRecordActions.tsx",
);
const inspectionSourcePicker = source(
  "../components/evidence/InspectionRecordSourcePicker.tsx",
);

test("care-planning and inspection records distinguish unavailable data and preserve client context on retry", () => {
  for (const [relativePath, route] of [
    ["care-planning/page.tsx", "/care-planning"],
    ["evidence/page.tsx", "/evidence"],
  ]) {
    const page = source(relativePath);
    assert.match(page, /StatePanel/);
    assert.match(page, /kind="unavailable"/);
    assert.match(page, new RegExp(`form action="${route}" method="get"`));
    assert.match(page, /name="clientId"/);
    assert.match(
      page,
      /No\s+changes\s+can be made until the connection recovers/,
    );
  }
});

test("Family access and workforce analytics never report API failures as empty or zero activity", () => {
  const carebridge = source("carebridge/page.tsx");
  const analytics = source("admin/analytics/page.tsx");

  assert.match(carebridge, /unavailable: true/);
  assert.match(carebridge, /This is not an empty room list/);
  assert.match(analytics, /analytics: null, unavailable: true/);
  assert.doesNotMatch(analytics, /activeCarersNow:\s*0/);
  assert.match(analytics, /The service is not reporting zero activity/);
});

test("inspection-source loading and failure keep record creation fail closed", () => {
  assert.match(
    inspectionSourcePicker,
    /setLoading\(true\)[\s\S]*?setError\(false\)[\s\S]*?onReadinessChange\(false\)/,
  );
  assert.match(
    inspectionSourcePicker,
    /setCandidates\(safeCandidates\)[\s\S]*?onReadinessChange\(true\)/,
  );
  assert.match(
    inspectionSourcePicker,
    /\.catch\(\(\) => \{[\s\S]*?setCandidates\(\[\]\)[\s\S]*?setError\(true\)[\s\S]*?onSelectedSourcesChange\(\[\]\)[\s\S]*?onReadinessChange\(false\)/,
  );
  assert.match(
    inspectionActions,
    /periodStart\s*&&\s*periodEnd\s*&&\s*Object\.keys\(nextErrors\)\.length === 0\s*&&\s*!operationalSourcesReady[\s\S]*?Wait for recorded items to finish loading/,
  );
  assert.match(
    inspectionActions,
    /disabled=\{\s*busy \|\|\s*Boolean\(periodStart && periodEnd && !operationalSourcesReady\)\s*\}/,
  );
});

test("date and source-filter changes discard stale hidden source selections", () => {
  const periodStartChange = inspectionActions.match(
    /id="inspection-period-start"[\s\S]*?onChange=\{\(event\) => \{([\s\S]*?)\}\}\s*className=/,
  );
  const periodEndChange = inspectionActions.match(
    /id="inspection-period-end"[\s\S]*?onChange=\{\(event\) => \{([\s\S]*?)\}\}\s*className=/,
  );

  assert.ok(periodStartChange, "Expected a period-start change handler");
  assert.ok(periodEndChange, "Expected a period-end change handler");
  for (const handler of [periodStartChange[1], periodEndChange[1]]) {
    assert.match(handler, /setSelectedOperationalSources\(\[\]\)/);
    assert.match(handler, /setOperationalSourcesReady\(false\)/);
  }

  assert.match(
    inspectionSourcePicker,
    /onSelectedSourcesChange\(\s*selectedSources\.filter\(\(source\) => next\.includes\(source\.sourceType\)\),?\s*\)/,
  );
  assert.match(
    inspectionSourcePicker,
    /\{selectedSources\.length\}\{["'] ["']\}[\s\S]*?\{selectedSources\.length === 1 \? ["']record["'] : ["']records["']\} selected/,
  );
  assert.doesNotMatch(
    inspectionSourcePicker,
    /candidates\.filter\([^)]*selectedKeys/,
  );
});
