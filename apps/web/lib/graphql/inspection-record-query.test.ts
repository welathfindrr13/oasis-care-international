import assert from 'node:assert/strict'
import test from 'node:test'
import {
  Kind,
  parse,
  type DocumentNode,
  type FieldNode,
  type SelectionSetNode,
} from 'graphql'
import {
  EVIDENCE_SOURCE_CANDIDATES_QUERY,
  INSPECTION_RECORD_CLIENT_QUERY,
  INSPECTION_RECORD_EXPORT_QUERY,
  INSPECTION_RECORDS_QUERY,
} from './queries'

function rootSelection(document: DocumentNode): SelectionSetNode {
  const operation = document.definitions.find(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  )
  assert.ok(operation && operation.kind === Kind.OPERATION_DEFINITION)
  return operation.selectionSet
}

function fieldAt(document: DocumentNode, path: string[]): FieldNode {
  let selectionSet = rootSelection(document)
  let current: FieldNode | undefined
  for (const name of path) {
    current = selectionSet.selections.find(
      (selection): selection is FieldNode =>
        selection.kind === Kind.FIELD && selection.name.value === name,
    )
    assert.ok(current, `Expected GraphQL field ${path.join('.')}`)
    assert.ok(current.selectionSet, `Expected ${path.join('.')} to select fields`)
    selectionSet = current.selectionSet
  }
  return current!
}

function selectedNames(field: FieldNode): string[] {
  assert.ok(field.selectionSet)
  return field.selectionSet.selections
    .filter((selection): selection is FieldNode => selection.kind === Kind.FIELD)
    .map((selection) => selection.name.value)
    .sort()
}

test('inspection source candidate query selects safe metadata only', () => {
  const document = parse(EVIDENCE_SOURCE_CANDIDATES_QUERY)
  assert.deepEqual(
    selectedNames(fieldAt(document, ['evidenceSourceCandidates'])),
    ['id', 'occurredAt', 'sourceType', 'status'],
  )
})

test('inspection workspace query selects safe record summaries only', () => {
  const document = parse(INSPECTION_RECORDS_QUERY)
  assert.deepEqual(selectedNames(fieldAt(document, ['assessments'])), [
    'completedAt',
    'createdAt',
    'id',
    'status',
    'title',
  ])
  assert.deepEqual(selectedNames(fieldAt(document, ['carePlans'])), [
    'approvedAt',
    'assessmentId',
    'createdAt',
    'effectiveFrom',
    'id',
    'status',
    'title',
    'version',
  ])
  assert.deepEqual(selectedNames(fieldAt(document, ['evidencePacks'])), [
    'carePlanId',
    'clientId',
    'generatedAt',
    'id',
    'items',
    'kind',
    'periodEnd',
    'periodStart',
    'publishedAt',
    'status',
  ])
  assert.deepEqual(
    selectedNames(fieldAt(document, ['evidencePacks', 'items'])),
    ['id', 'occurredAt', 'sourceType'],
  )
})

test('inspection export query cannot select raw content or actor fields', () => {
  const document = parse(INSPECTION_RECORD_EXPORT_QUERY)
  assert.deepEqual(selectedNames(fieldAt(document, ['getEvidencePack'])), [
    'clientId',
    'generatedAt',
    'id',
    'items',
    'kind',
    'periodEnd',
    'periodStart',
    'publishedAt',
    'status',
  ])
  assert.deepEqual(
    selectedNames(fieldAt(document, ['getEvidencePack', 'items'])),
    ['id', 'occurredAt', 'sourceType'],
  )

  const printedSource = INSPECTION_RECORD_EXPORT_QUERY
  for (const forbidden of [
    'summary',
    'sourceRefs',
    'generatedBy',
    'sourceId',
    'headline',
    'detail',
    'metadata',
    'createdBy',
    'previewText',
  ]) {
    assert.doesNotMatch(printedSource, new RegExp(`\\b${forbidden}\\b`))
  }
})

test('inspection export client query selects the display name only', () => {
  const document = parse(INSPECTION_RECORD_CLIENT_QUERY)
  assert.deepEqual(selectedNames(fieldAt(document, ['client'])), ['fullName'])
})
