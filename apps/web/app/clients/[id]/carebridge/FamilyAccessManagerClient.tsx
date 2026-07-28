'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../../../components/ui/Card'
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog'
import { FieldError } from '../../../../components/ui/FieldError'
import { useClientAccess } from '../../../../components/providers/ClientAccessProvider'
import { clientQuery } from '../../../../lib/graphql/client-side'
import {
  CREATE_CARE_ROOM_MUTATION,
  INVITE_FAMILY_CONTACT_MUTATION,
  RETRY_FAMILY_INVITATION_DELIVERY_MUTATION,
  REVOKE_FAMILY_ACCESS_MUTATION,
  REVOKE_FAMILY_INVITATION_MUTATION,
  UPDATE_FAMILY_ACCESS_GRANTS_MUTATION,
  type CarebridgeMembership,
  type CarebridgeRoom,
  type CreateCareRoomMutationResponse,
  type FamilyMembershipMutationResponse,
} from '../../../../lib/graphql/queries'

type InviteDraft = {
  fullName: string
  email: string
  relationship: string
  accessBasis: string
}

type ConfirmAction =
  | { kind: 'cancel'; membership: CarebridgeMembership }
  | { kind: 'resend'; membership: CarebridgeMembership }
  | { kind: 'revoke'; membership: CarebridgeMembership }

type OperationError = {
  message: string
  targetId: string
}

const emptyInvite: InviteDraft = {
  fullName: '',
  email: '',
  relationship: '',
  accessBasis: 'PROVIDER_AUTHORISED',
}

export function FamilyAccessManagerClient({
  clientId,
  initialRoom,
  personName,
}: {
  clientId: string
  initialRoom: CarebridgeRoom | null
  personName: string
}) {
  const access = useClientAccess()
  const router = useRouter()
  const [room, setRoom] = useState(initialRoom)
  const [invite, setInvite] = useState<InviteDraft>(emptyInvite)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof InviteDraft, string>>
  >({})
  const [pageError, setPageError] = useState<OperationError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const errorSummaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pageError || Object.keys(fieldErrors).length > 0)
      errorSummaryRef.current?.focus()
  }, [fieldErrors, pageError])

  useEffect(() => {
    setRoom(initialRoom)
  }, [initialRoom])

  function resetOutcome() {
    setPageError(null)
    setNotice(null)
  }

  function reportError(message: string, targetId: string) {
    setPageError({ message, targetId })
  }

  function reportDeliveryOutcome(
    membership: CarebridgeMembership,
    deliveredMessage: string,
  ) {
    if (membership.deliveryStatus === 'DELIVERED') {
      setNotice(deliveredMessage)
      return
    }
    if (membership.deliveryStatus === 'RETRYABLE') {
      reportError(
        `${membership.familyContact.fullName} was added with no access, but the invitation email was not delivered. Use Retry delivery.`,
        `family-retry-${membership.id}`,
      )
      return
    }
    if (membership.deliveryStatus === 'NEEDS_ATTENTION') {
      reportError(
        `${membership.familyContact.fullName} was added with no access, but invitation delivery needs attention. Use Retry delivery or ask an administrator for help.`,
        `family-retry-${membership.id}`,
      )
      return
    }
    setNotice(
      `${membership.familyContact.fullName} was added with no access. Invitation delivery is still being processed.`,
    )
  }

  function replaceMembership(next: CarebridgeMembership) {
    setRoom((current) => {
      if (!current) return current
      const exists = current.memberships.some(
        (membership) => membership.id === next.id,
      )
      return {
        ...current,
        memberships: exists
          ? current.memberships.map((membership) =>
              membership.id === next.id ? next : membership,
            )
          : [...current.memberships, next],
      }
    })
  }

  async function setUpRoom() {
    resetOutcome()
    setBusy('room')
    try {
      const data = await clientQuery<CreateCareRoomMutationResponse>(
        CREATE_CARE_ROOM_MUTATION,
        { input: { clientId } },
        { getBearerToken: access.getBearerToken },
      )
      setRoom(data.createCareRoom)
      setNotice(`Family access is ready to set up for ${personName}.`)
      router.refresh()
    } catch {
      reportError(
        'We could not set up family access. Please try again.',
        'family-room-setup',
      )
    } finally {
      setBusy(null)
    }
  }

  function validateInvite() {
    const next: Partial<Record<keyof InviteDraft, string>> = {}
    if (!invite.fullName.trim())
      next.fullName = 'Enter the family member’s name.'
    const email = invite.email.trim()
    if (!email || !email.includes('@'))
      next.email = 'Enter a valid email address.'
    if (!invite.accessBasis)
      next.accessBasis = 'Choose why this access is being provided.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetOutcome()
    if (!room || !validateInvite()) return
    setBusy('invite')
    try {
      const data = await clientQuery<FamilyMembershipMutationResponse>(
        INVITE_FAMILY_CONTACT_MUTATION,
        {
          input: {
            careRoomId: room.id,
            fullName: invite.fullName.trim(),
            email: invite.email.trim(),
            relationship: invite.relationship.trim() || undefined,
            role: 'FAMILY_VIEWER',
            accessBasis: invite.accessBasis,
          },
        },
        { getBearerToken: access.getBearerToken },
      )
      if (!data.inviteFamilyContact)
        throw new Error('Missing invitation result')
      replaceMembership(data.inviteFamilyContact)
      setInvite(emptyInvite)
      setFieldErrors({})
      reportDeliveryOutcome(
        data.inviteFamilyContact,
        `Invitation sent to ${data.inviteFamilyContact.familyContact.fullName}. Access starts with nothing shared.`,
      )
    } catch {
      reportError(
        'We could not send the invitation. Check the details and try again; your entries have been kept.',
        'family-invite-form',
      )
    } finally {
      setBusy(null)
    }
  }

  async function retryDelivery(membership: CarebridgeMembership) {
    if (!membership.invitationId) return
    resetOutcome()
    setBusy(membership.id)
    try {
      const data = await clientQuery<FamilyMembershipMutationResponse>(
        RETRY_FAMILY_INVITATION_DELIVERY_MUTATION,
        { input: { invitationId: membership.invitationId } },
        { getBearerToken: access.getBearerToken },
      )
      if (!data.retryFamilyInvitationDelivery)
        throw new Error('Missing retry result')
      replaceMembership(data.retryFamilyInvitationDelivery)
      reportDeliveryOutcome(
        data.retryFamilyInvitationDelivery,
        `Invitation sent to ${membership.familyContact.fullName}.`,
      )
    } catch {
      reportError(
        'We could not retry delivery. The invitation has not been changed.',
        `family-retry-${membership.id}`,
      )
    } finally {
      setBusy(null)
    }
  }

  async function saveGrants(
    membership: CarebridgeMembership,
    approvedUpdates: boolean,
    concerns: boolean,
  ) {
    resetOutcome()
    setBusy(membership.id)
    const scopes = [
      ...(approvedUpdates ? ['VIEW_UPDATES', 'VIEW_TASK_SUMMARY'] : []),
      ...(concerns ? ['RAISE_CONCERNS'] : []),
    ]
    try {
      const data = await clientQuery<FamilyMembershipMutationResponse>(
        UPDATE_FAMILY_ACCESS_GRANTS_MUTATION,
        { input: { careRoomMembershipId: membership.id, scopes } },
        { getBearerToken: access.getBearerToken },
      )
      if (!data.updateFamilyAccessGrants)
        throw new Error('Missing grant result')
      replaceMembership(data.updateFamilyAccessGrants)
      setNotice(
        `Sharing choices saved for ${membership.familyContact.fullName}.`,
      )
    } catch {
      reportError(
        'We could not save these sharing choices. Your selections have been kept.',
        `family-grants-${membership.id}`,
      )
      throw new Error('grant-save-failed')
    } finally {
      setBusy(null)
    }
  }

  async function runConfirmedAction() {
    const action = confirmAction
    if (!action) return
    setConfirmAction(null)
    resetOutcome()
    setBusy(action.membership.id)
    try {
      if (action.kind === 'revoke') {
        const data = await clientQuery<FamilyMembershipMutationResponse>(
          REVOKE_FAMILY_ACCESS_MUTATION,
          { input: { careRoomMembershipId: action.membership.id } },
          { getBearerToken: access.getBearerToken },
        )
        if (!data.revokeFamilyAccess) throw new Error('Missing revoke result')
        replaceMembership(data.revokeFamilyAccess)
        setNotice(
          `Access revoked for ${action.membership.familyContact.fullName}.`,
        )
        return
      }

      if (!action.membership.invitationId)
        throw new Error('Invitation is unavailable')
      const revoked = await clientQuery<FamilyMembershipMutationResponse>(
        REVOKE_FAMILY_INVITATION_MUTATION,
        { input: { invitationId: action.membership.invitationId } },
        { getBearerToken: access.getBearerToken },
      )
      if (!revoked.revokeFamilyInvitation)
        throw new Error('Missing cancellation result')
      replaceMembership(revoked.revokeFamilyInvitation)

      if (action.kind === 'cancel') {
        setNotice(
          `Invitation cancelled for ${action.membership.familyContact.fullName}.`,
        )
        return
      }

      if (revoked.revokeFamilyInvitation.cleanupStatus !== 'COMPLETE') {
        reportError(
          'The old invitation was cancelled internally, but external cleanup needs attention. No replacement was sent.',
          `family-membership-${action.membership.id}`,
        )
        return
      }
      if (!room) throw new Error('Room is unavailable')
      const replacement = await clientQuery<FamilyMembershipMutationResponse>(
        INVITE_FAMILY_CONTACT_MUTATION,
        {
          input: {
            careRoomId: room.id,
            fullName: action.membership.familyContact.fullName,
            email: action.membership.familyContact.email,
            relationship:
              action.membership.familyContact.relationship || undefined,
            role: 'FAMILY_VIEWER',
            accessBasis: action.membership.accessBasis,
          },
        },
        { getBearerToken: access.getBearerToken },
      )
      if (!replacement.inviteFamilyContact)
        throw new Error('Missing replacement result')
      replaceMembership(replacement.inviteFamilyContact)
      reportDeliveryOutcome(
        replacement.inviteFamilyContact,
        `A new invitation was sent to ${action.membership.familyContact.fullName}. It starts with nothing shared.`,
      )
    } catch {
      reportError(
        action.kind === 'resend'
          ? 'We could not safely resend the invitation. Access may have changed while you were working, so the latest status will be reloaded.'
          : 'We could not complete that action. Nothing further was changed.',
        'family-members-heading',
      )
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const confirmation = confirmationCopy(confirmAction, personName)

  return (
    <section aria-labelledby="family-access-heading" className="space-y-5">
      <div>
        <h2
          id="family-access-heading"
          className="font-heading text-2xl font-semibold text-oasis-ink"
        >
          Manage family access
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-oasis-muted">
          Invite a family member, then choose what they can do after they
          accept. Invitations begin with no access.
        </p>
      </div>

      {pageError || Object.keys(fieldErrors).length > 0 ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          className="rounded-md border-2 border-oasis-danger bg-oasis-danger-soft p-4 outline-none"
          role="alert"
        >
          <h3 className="font-semibold text-oasis-danger">
            There is a problem
          </h3>
          {pageError ? (
            <p className="mt-2 text-sm text-oasis-danger">
              <a
                className="font-medium underline"
                href={`#${pageError.targetId}`}
              >
                {pageError.message}
              </a>
            </p>
          ) : null}
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {Object.entries(fieldErrors).map(([field, message]) => (
              <li key={field}>
                <a className="font-medium underline" href={`#family-${field}`}>
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {notice ? (
        <Alert live tone="success" title="Family access updated">
          {notice}
        </Alert>
      ) : null}

      {!room ? (
        <Card>
          <CardHeader>
            <h3 className="font-heading text-lg font-semibold text-oasis-ink">
              Set up access for {personName}
            </h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-oasis-muted">
              No family member can find or link themselves to this person. A
              manager must set up access here.
            </p>
            <Button
              id="family-room-setup"
              className="mt-4"
              disabled={busy === 'room'}
              onClick={setUpRoom}
            >
              {busy === 'room' ? 'Setting up…' : 'Set up family access'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <h3 className="font-heading text-lg font-semibold text-oasis-ink">
                Invite a family member
              </h3>
              <p className="mt-2 text-sm text-oasis-muted">
                They must accept the invitation before you can share approved
                updates or allow concerns.
              </p>
            </CardHeader>
            <CardContent>
              <form
                id="family-invite-form"
                tabIndex={-1}
                className="space-y-4 outline-none"
                onSubmit={submitInvite}
                noValidate
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <InviteField
                    id="fullName"
                    label="Full name"
                    value={invite.fullName}
                    error={fieldErrors.fullName}
                    onChange={(fullName) =>
                      setInvite((draft) => ({ ...draft, fullName }))
                    }
                  />
                  <InviteField
                    id="email"
                    label="Email address"
                    type="email"
                    value={invite.email}
                    error={fieldErrors.email}
                    onChange={(email) =>
                      setInvite((draft) => ({ ...draft, email }))
                    }
                  />
                  <InviteField
                    id="relationship"
                    label="Relationship (optional)"
                    value={invite.relationship}
                    error={fieldErrors.relationship}
                    onChange={(relationship) =>
                      setInvite((draft) => ({ ...draft, relationship }))
                    }
                  />
                  <label
                    className="block text-sm font-medium text-oasis-ink"
                    htmlFor="family-accessBasis"
                  >
                    Reason for access
                    <select
                      id="family-accessBasis"
                      className="mt-2 block min-h-11 w-full rounded-md border border-oasis-control-border bg-white px-3"
                      value={invite.accessBasis}
                      aria-invalid={Boolean(fieldErrors.accessBasis)}
                      aria-describedby={
                        fieldErrors.accessBasis
                          ? 'family-accessBasis-error'
                          : undefined
                      }
                      onChange={(event) =>
                        setInvite((draft) => ({
                          ...draft,
                          accessBasis: event.target.value,
                        }))
                      }
                    >
                      <option value="PROVIDER_AUTHORISED">
                        Provider authorised
                      </option>
                      <option value="CLIENT_CONSENT">
                        Person has consented
                      </option>
                      <option value="HEALTH_WELFARE_ATTORNEY">
                        Health and welfare attorney
                      </option>
                      <option value="BEST_INTERESTS">
                        Best interests decision
                      </option>
                    </select>
                    {fieldErrors.accessBasis ? (
                      <FieldError id="family-accessBasis-error">
                        {fieldErrors.accessBasis}
                      </FieldError>
                    ) : null}
                  </label>
                </div>
                <Button disabled={busy === 'invite'} type="submit">
                  {busy === 'invite' ? 'Sending…' : 'Send invitation'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3
              id="family-members-heading"
              tabIndex={-1}
              className="font-heading text-xl font-semibold text-oasis-ink outline-none"
            >
              Family members
            </h3>
            {room.memberships.length === 0 ? (
              <Card>
                <p className="text-sm text-oasis-muted">
                  No family members have been invited yet.
                </p>
              </Card>
            ) : (
              room.memberships.map((membership) => (
                <MembershipCard
                  key={`${membership.id}:${membership.invitationId || membership.status}`}
                  busy={busy === membership.id}
                  membership={membership}
                  onCancel={() =>
                    setConfirmAction({ kind: 'cancel', membership })
                  }
                  onResend={() =>
                    setConfirmAction({ kind: 'resend', membership })
                  }
                  onRetry={() => retryDelivery(membership)}
                  onRevoke={() =>
                    setConfirmAction({ kind: 'revoke', membership })
                  }
                  onSave={saveGrants}
                />
              ))
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        returnFocusId="family-members-heading"
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
    </section>
  )
}

function InviteField({
  error,
  id,
  label,
  onChange,
  type = 'text',
  value,
}: {
  error?: string
  id: keyof InviteDraft
  label: string
  onChange: (value: string) => void
  type?: string
  value: string
}) {
  const inputId = `family-${id}`
  const errorId = `${inputId}-error`
  return (
    <label
      className="block text-sm font-medium text-oasis-ink"
      htmlFor={inputId}
    >
      {label}
      <input
        id={inputId}
        type={type}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 block min-h-11 w-full rounded-md border border-oasis-control-border bg-white px-3"
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </label>
  )
}

function MembershipCard({
  busy,
  membership,
  onCancel,
  onResend,
  onRetry,
  onRevoke,
  onSave,
}: {
  busy: boolean
  membership: CarebridgeMembership
  onCancel: () => void
  onResend: () => void
  onRetry: () => void
  onRevoke: () => void
  onSave: (
    membership: CarebridgeMembership,
    approvedUpdates: boolean,
    concerns: boolean,
  ) => Promise<void>
}) {
  const activeScopes = useMemo(
    () =>
      new Set(
        membership.accessGrants
          .filter((grant) => !grant.revokedAt)
          .map((grant) => grant.scope),
      ),
    [membership.accessGrants],
  )
  const [approvedUpdates, setApprovedUpdates] = useState(
    activeScopes.has('VIEW_UPDATES') && activeScopes.has('VIEW_TASK_SUMMARY'),
  )
  const [concerns, setConcerns] = useState(activeScopes.has('RAISE_CONCERNS'))
  const isActive = membership.status === 'ACTIVE'
  const isPending =
    membership.status === 'INVITED' && membership.invitationStatus === 'PENDING'
  const canRetry =
    isPending &&
    ['RETRYABLE', 'NEEDS_ATTENTION'].includes(membership.deliveryStatus || '')
  const canResend = isPending && membership.deliveryStatus === 'DELIVERED'

  useEffect(() => {
    setApprovedUpdates(
      activeScopes.has('VIEW_UPDATES') && activeScopes.has('VIEW_TASK_SUMMARY'),
    )
    setConcerns(activeScopes.has('RAISE_CONCERNS'))
  }, [activeScopes])

  return (
    <Card
      id={`family-membership-${membership.id}`}
      tabIndex={-1}
      className="outline-none"
    >
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-semibold text-oasis-ink">
            {membership.familyContact.fullName}
          </h4>
          <p className="mt-1 break-all text-sm text-oasis-muted">
            {membership.familyContact.email}
          </p>
          {membership.familyContact.relationship ? (
            <p className="mt-1 text-sm text-oasis-muted">
              {membership.familyContact.relationship}
            </p>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-oasis-ink">
          {membershipStatus(membership)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {membership.cleanupStatus === 'MANUAL_REVIEW' ? (
          <Alert tone="attention" title="Cleanup needs attention">
            Internal access remains blocked. An administrator must retry
            external invitation cleanup before sending another invitation.
          </Alert>
        ) : null}

        {isActive ? (
          <fieldset
            id={`family-grants-${membership.id}`}
            tabIndex={-1}
            className="space-y-3 outline-none"
          >
            <legend className="font-semibold text-oasis-ink">
              What this person can access
            </legend>
            <AccessToggle
              checked={approvedUpdates}
              label="Approved care updates"
              description="View approved care updates and task summaries."
              onChange={setApprovedUpdates}
            />
            <AccessToggle
              checked={concerns}
              label="Send concerns"
              description="Send a question or concern to the care team."
              onChange={setConcerns}
            />
            <Button
              disabled={busy}
              onClick={() =>
                void onSave(membership, approvedUpdates, concerns).catch(
                  () => undefined,
                )
              }
            >
              {busy ? 'Saving…' : 'Save sharing choices'}
            </Button>
          </fieldset>
        ) : null}

        <div
          id={`family-actions-${membership.id}`}
          tabIndex={-1}
          className="flex flex-wrap gap-2 outline-none"
        >
          {canRetry ? (
            <Button
              id={`family-retry-${membership.id}`}
              disabled={busy}
              variant="secondary"
              onClick={onRetry}
            >
              Retry delivery
            </Button>
          ) : null}
          {canResend ? (
            <Button disabled={busy} variant="secondary" onClick={onResend}>
              Resend invitation
            </Button>
          ) : null}
          {isPending ? (
            <Button disabled={busy} variant="danger" onClick={onCancel}>
              Cancel invitation
            </Button>
          ) : null}
          {isActive ? (
            <Button disabled={busy} variant="danger" onClick={onRevoke}>
              Revoke access
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function AccessToggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-md border border-oasis-border p-3">
      <input
        className="mt-1 h-5 w-5"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-medium text-oasis-ink">{label}</span>
        <span className="mt-1 block text-sm text-oasis-muted">
          {description}
        </span>
      </span>
    </label>
  )
}

function membershipStatus(membership: CarebridgeMembership) {
  if (membership.status === 'ACTIVE') return 'Access active'
  if (membership.status === 'REVOKED')
    return membership.cleanupStatus === 'MANUAL_REVIEW'
      ? 'Cancelled — cleanup needed'
      : 'Access ended'
  if (membership.status === 'EXPIRED') return 'Invitation expired'
  if (membership.deliveryStatus === 'DELIVERED')
    return 'Invitation sent — awaiting acceptance'
  if (membership.deliveryStatus === 'RETRYABLE')
    return 'Delivery failed — can retry'
  if (membership.deliveryStatus === 'NEEDS_ATTENTION')
    return 'Delivery needs attention'
  return 'Invitation being sent'
}

function confirmationCopy(action: ConfirmAction | null, personName: string) {
  if (!action) return { title: '', description: '', confirmLabel: 'Continue' }
  const name = action.membership.familyContact.fullName
  if (action.kind === 'resend') {
    return {
      title: `Resend invitation to ${name}?`,
      description: `The current invitation for ${personName} will be cancelled before a zero-access replacement is sent. If acceptance wins first, no replacement will be sent.`,
      confirmLabel: 'Resend invitation',
    }
  }
  if (action.kind === 'cancel') {
    return {
      title: `Cancel invitation for ${name}?`,
      description: `They will not be able to use this invitation to access ${personName}’s information.`,
      confirmLabel: 'Cancel invitation',
    }
  }
  return {
    title: `Revoke access for ${name}?`,
    description: `Their access to ${personName} will stop immediately. The person’s care information will remain intact.`,
    confirmLabel: 'Revoke access',
  }
}
