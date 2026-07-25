import assert from 'node:assert/strict'
import test from 'node:test'
import { runConfirmedAction } from './consequential-actions'

test('cancelled consequential actions perform no mutation', async () => {
  let mutations = 0

  const result = await runConfirmedAction(
    () => false,
    'Confirm action',
    async () => {
      mutations += 1
    },
  )

  assert.equal(result, 'cancelled')
  assert.equal(mutations, 0)
})

test('confirmed consequential actions perform exactly one mutation', async () => {
  let mutations = 0

  const result = await runConfirmedAction(
    () => true,
    'Confirm action',
    async () => {
      mutations += 1
    },
  )

  assert.equal(result, 'completed')
  assert.equal(mutations, 1)
})
