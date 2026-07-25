import assert from 'node:assert/strict'
import React from 'react'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusChip } from './StatusChip'

test('cancelled visits render a safe neutral status', () => {
  const markup = renderToStaticMarkup(<StatusChip status="CANCELLED" />)

  assert.match(markup, />Cancelled</)
  assert.match(markup, /bg-base-gray-100/)
})

test('unknown visit statuses render a human-readable neutral fallback', () => {
  const markup = renderToStaticMarkup(<StatusChip status="WAITING_FOR_REVIEW" />)

  assert.match(markup, />Waiting for review</)
  assert.match(markup, /bg-base-gray-100/)
  assert.doesNotMatch(markup, /undefined/)
})
