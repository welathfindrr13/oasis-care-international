import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('eMAR defaults to the organization date rather than the UTC host date', () => {
  const source = read('./emar/page.tsx')
  assert.match(source, /return organizationDateKey\(\)/)
  assert.match(source, /startDate: newPrescription\.startDate/)
  assert.match(source, /endDate: newPrescription\.endDate \|\| null/)
  assert.doesNotMatch(source, /toISOString\(\)\.split\(['"]T['"]\)/)
  assert.doesNotMatch(source, /T00:00:00\.000Z|T23:59:59\.999Z/)
})

test('care-log month filters share organization calendar boundaries with summaries', () => {
  const source = read('./clients/[id]/care-logs/page.tsx')
  assert.match(source, /getOrganizationMonthUtcRange\(year, month\)/)
  assert.doesNotMatch(source, /Date\.UTC\(year, month/)
})

test('person and care-planning views do not format or filter care dates in the host timezone', () => {
  const person = read('./clients/[id]/page.tsx')
  const picker = read('../components/evidence/InspectionRecordSourcePicker.tsx')
  const actions = read('../components/care-planning/CarePlanningActions.tsx')
  const inspectionActions = read('../components/evidence/InspectionRecordActions.tsx')

  assert.match(person, /return formatDateTime\(value, \{ weekday: ['"]short['"] \}\)/)
  assert.match(person, /return formatDate\(value\)/)
  assert.doesNotMatch(person, /Intl\.DateTimeFormat/)
  assert.match(picker, /getOrganizationDateUtcRange\(value\)/)
  assert.match(picker, /formatDateTime\(value, \{ year: undefined \}\)/)
  assert.doesNotMatch(picker, /T00:00:00\.000Z|T23:59:59\.000Z/)
  assert.match(actions, /getOrganizationDateUtcRange\(value\)/)
  assert.doesNotMatch(actions, /T00:00:00\.000Z|T23:59:59\.000Z/)
  assert.match(inspectionActions, /organizationDateKeyToStoredDateIso\(periodStart\)/)
  assert.match(inspectionActions, /organizationDateKeyToStoredDateIso\(periodEnd\)/)
})

test('inspection records and PDF use central instant and stored-date formatters', () => {
  const dashboard = read('./evidence/page.tsx')
  const pdf = read('../components/evidence/InspectionRecordPdf.tsx')

  for (const source of [dashboard, pdf]) {
    assert.match(source, /formatStoredCalendarDate/)
    assert.doesNotMatch(source, /new Intl\.DateTimeFormat/)
  }
  assert.match(dashboard, /formatDate\(record\.generatedAt\)/)
  assert.match(pdf, /formatDateTime\(value\)/)
})

test('inspection-record periods render date-only fields without host timezone shifts', () => {
  const source = read('./evidence/page.tsx')

  assert.match(source, /formatStoredCalendarDate\(record\.periodStart\)/)
  assert.match(source, /formatStoredCalendarDate\(record\.periodEnd\)/)
  assert.doesNotMatch(source, /formatDate\(record\.period(?:Start|End)\)/)
})

test('health summary generation sends inclusive stored calendar keys', () => {
  const source = read('./clients/[id]/summary/page.tsx')

  assert.match(source, /getOrganizationWeekStoredDateRange\(\)/)
  assert.match(source, /periodStart: week\.start/)
  assert.match(source, /periodEnd: week\.end/)
  assert.doesNotMatch(source, /getOrganizationWeekUtcRange/)
})
