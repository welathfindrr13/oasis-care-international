import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMaskedActorLabel, getComplianceSubjectContext } from '../compliance'

test('builds a selected subject context from compliance query params', () => {
  const context = getComplianceSubjectContext({
    subjectId: '34bd571f-22cd-4bcc-a296-f576ba3dbbc3',
    subjectName: 'Browser Test Client',
    subjectType: 'client',
  })

  assert.deepEqual(context, {
    id: '34bd571f-22cd-4bcc-a296-f576ba3dbbc3',
    name: 'Browser Test Client',
    type: 'client',
  })
})

test('masks audit actors into a shorter staff label', () => {
  assert.equal(
    formatMaskedActorLabel('96820204-0071-70ec-72ec-b363c6e05b1d'),
    'Staff record 96820204...5b1d'
  )
})
