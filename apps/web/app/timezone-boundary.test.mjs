import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('eMAR defaults to the organization date rather than the UTC host date', () => {
  const source = read('./emar/page.tsx')
  assert.match(source, /return organizationDateKey\(\)/)
  assert.doesNotMatch(source, /toISOString\(\)\.split\(['"]T['"]\)/)
})

test('care-log month filters share organization calendar boundaries with summaries', () => {
  const source = read('./clients/[id]/care-logs/page.tsx')
  assert.match(source, /getOrganizationMonthUtcRange\(year, month\)/)
  assert.doesNotMatch(source, /Date\.UTC\(year, month/)
})

test('person and care-planning views do not format or filter care dates in the host timezone', () => {
  const person = read('./clients/[id]/page.tsx')
  const picker = read('../components/care-planning/EvidenceSourcePicker.tsx')
  const actions = read('../components/care-planning/CarePlanningActions.tsx')

  assert.match(person, /return formatDateTime\(value, \{ weekday: ['"]short['"] \}\)/)
  assert.match(person, /return formatDate\(value\)/)
  assert.doesNotMatch(person, /Intl\.DateTimeFormat/)
  assert.match(picker, /getOrganizationDateUtcRange\(value\)/)
  assert.match(picker, /formatDateTime\(value, \{ year: undefined \}\)/)
  assert.doesNotMatch(picker, /T00:00:00\.000Z|T23:59:59\.000Z/)
  assert.match(actions, /getOrganizationDateUtcRange\(value\)/)
  assert.match(actions, /organizationDateKeyToStoredDateIso\(value\)/)
  assert.doesNotMatch(actions, /T00:00:00\.000Z|T23:59:59\.000Z/)
})

test('evidence dashboard and PDF use central instant and stored-date formatters', () => {
  const dashboard = read('./evidence/page.tsx')
  const pdf = read('../components/evidence/EvidencePackPdf.tsx')

  for (const source of [dashboard, pdf]) {
    assert.match(source, /formatStoredCalendarDate/)
    assert.doesNotMatch(source, /new Intl\.DateTimeFormat/)
  }
  assert.match(dashboard, /formatDate\(value\)/)
  assert.match(pdf, /formatDateTime\(value\)/)
})

test('health summary generation sends inclusive stored calendar keys', () => {
  const source = read('./clients/[id]/summary/page.tsx')

  assert.match(source, /getOrganizationWeekStoredDateRange\(\)/)
  assert.match(source, /periodStart: week\.start/)
  assert.match(source, /periodEnd: week\.end/)
  assert.doesNotMatch(source, /getOrganizationWeekUtcRange/)
})
