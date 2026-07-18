import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const manager = readFileSync(new URL('./clients/[id]/carebridge/FamilyAccessManagerClient.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('./clients/[id]/carebridge/page.tsx', import.meta.url), 'utf8')
const queries = readFileSync(new URL('../lib/graphql/queries.ts', import.meta.url), 'utf8')
const confirmDialog = readFileSync(new URL('../components/ui/ConfirmDialog.tsx', import.meta.url), 'utf8')

test('Family access is managed only from the selected person context', () => {
  assert.match(page, /Family access for \{person\.fullName\}/)
  assert.match(page, /CLIENT_QUERY/)
  assert.match(manager, /clientId/)
  assert.match(manager, /Set up family access/)
  assert.doesNotMatch(`${page}\n${manager}`, /search for a person|self-link|link yourself/i)
})

test('invites start with no grants and expose only the launch sharing choices', () => {
  assert.match(manager, /Invitations begin with no access/)
  assert.match(manager, /role: 'FAMILY_VIEWER'/)
  assert.match(manager, /Approved care updates/)
  assert.match(manager, /Send concerns/)
  assert.match(manager, /'VIEW_UPDATES', 'VIEW_TASK_SUMMARY'/)
  assert.match(manager, /'RAISE_CONCERNS'/)
  assert.doesNotMatch(manager, /VIEW_MEDICATION_SUPPORT_STATUS|VIEW_VISIT_TIMES|VIEW_WEEKLY_SUMMARIES|REPLY_TO_CONCERNS|SUBMIT_PULSE/)
})

test('Manager lifecycle controls reuse the canonical server operations', () => {
  for (const operation of [
    'CREATE_CARE_ROOM_MUTATION',
    'INVITE_FAMILY_CONTACT_MUTATION',
    'UPDATE_FAMILY_ACCESS_GRANTS_MUTATION',
    'RETRY_FAMILY_INVITATION_DELIVERY_MUTATION',
    'REVOKE_FAMILY_INVITATION_MUTATION',
    'REVOKE_FAMILY_ACCESS_MUTATION',
  ]) {
    assert.match(manager, new RegExp(operation))
    assert.match(queries, new RegExp(`export const ${operation}`))
  }
  assert.match(manager, /Retry delivery/)
  assert.match(manager, /Resend invitation/)
  assert.match(manager, /Cancel invitation/)
  assert.match(manager, /Revoke access/)
})

test('resend cancels and completes cleanup before creating a zero-access replacement', () => {
  const resend = manager.slice(manager.indexOf('async function runConfirmedAction'))
  assert.ok(resend.indexOf('REVOKE_FAMILY_INVITATION_MUTATION') < resend.indexOf('INVITE_FAMILY_CONTACT_MUTATION'))
  assert.match(resend, /cleanupStatus !== 'COMPLETE'/)
  assert.match(resend, /No replacement was sent/)
  assert.match(resend, /starts with nothing shared/)
  assert.match(resend, /router\.refresh\(\)/)
})

test('errors retain values, link to controls, announce status, and confirmations restore focus', () => {
  assert.match(manager, /your entries have been kept/i)
  assert.match(manager, /your selections have been kept/i)
  assert.match(manager, /tabIndex=\{-1\}/)
  assert.match(manager, /href=\{`#family-\$\{field\}`\}/)
  assert.match(manager, /<Alert live tone="success"/)
  assert.match(confirmDialog, /openerRef/)
  assert.match(confirmDialog, /opener\?\.isConnected/)
  assert.match(confirmDialog, /opener\.focus\(\)/)
})
