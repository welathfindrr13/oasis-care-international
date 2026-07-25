import assert from 'node:assert/strict'
import test from 'node:test'
import {
  restoreActionFocus,
  runConfirmedAction,
  runSingleFlightAction,
} from './consequential-actions'

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

test('rapid repeated consequential actions execute the mutation once', async () => {
  const startedRef = { current: false }
  let releaseAction: (() => void) | undefined
  let mutations = 0
  const pending = new Promise<void>((resolve) => {
    releaseAction = resolve
  })
  const action = async () => {
    mutations += 1
    await pending
  }

  const first = runSingleFlightAction(startedRef, action)
  const second = await runSingleFlightAction(startedRef, action)
  assert.equal(second, 'ignored')
  assert.equal(mutations, 1)

  releaseAction?.()
  await first
  assert.equal(startedRef.current, false)
})

test('inline confirmation cancellation restores focus through the scheduled callback', () => {
  let focusCalls = 0
  let scheduled = false

  restoreActionFocus(
    { focus: () => { focusCalls += 1 } },
    (callback) => {
      scheduled = true
      callback()
    },
  )

  assert.equal(scheduled, true)
  assert.equal(focusCalls, 1)
})
