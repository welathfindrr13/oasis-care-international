export function mapCareBridgePolicy(policy: any) {
  if (!policy) return null;
  return {
    id: policy.id,
    requireApprovalForAllContent: policy.require_approval_for_all_content,
    familyCanRaiseConcerns: policy.family_can_raise_concerns,
    familyCanReplyToConcerns: policy.family_can_reply_to_concerns,
    allowMedicationSupportStatus: policy.allow_medication_support_status,
    policyScope: {
      organizationId: policy.organization_id,
      careRoomId: policy.care_room_id ?? null,
      clientId: policy.client_id ?? null,
    },
  };
}

export function mapAccessGrant(grant: any) {
  return {
    id: grant.id,
    scope: grant.scope,
    grantedAt: grant.granted_at,
    revokedAt: grant.revoked_at,
  };
}

export function mapFamilyContact(contact: any) {
  return {
    id: contact.id,
    fullName: contact.full_name,
    email: contact.email,
    phone: contact.phone,
    relationship: contact.relationship,
  };
}

export function mapCareRoomMembership(membership: any) {
  return {
    id: membership.id,
    role: membership.role,
    status: membership.status,
    accessBasis: membership.access_basis,
    reviewDueAt: membership.review_due_at,
    familyContact: mapFamilyContact(membership.family_contact),
    accessGrants: (membership.access_grants || []).map(mapAccessGrant),
  };
}

export function mapCareRoom(room: any) {
  return {
    id: room.id,
    clientId: room.client_id,
    status: room.status,
    memberships: (room.memberships || []).map(mapCareRoomMembership),
    effectivePolicy: mapCareBridgePolicy(room.effectivePolicy),
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

export function mapVerifiedVisitStory(story: any) {
  return {
    id: story.id,
    careRoomId: story.care_room_id,
    clientId: story.client_id,
    visitId: story.visit_id,
    status: story.status,
    draftTitle: story.draft_title,
    draftBody: story.draft_body,
    approvedTitle: story.approved_title,
    approvedBody: story.approved_body,
    sourceRefs: story.source_refs,
    approvedAt: story.approved_at,
    publishedAt: story.published_at,
  };
}

export function mapConcernMessage(message: any) {
  return {
    id: message.id,
    body: message.body,
    actorType: message.actor_type,
    actorLabel: message.actor_label,
    createdAt: message.created_at,
  };
}

export function mapConcernEvent(event: any) {
  return {
    id: event.id,
    eventType: event.event_type,
    actorType: event.actor_type,
    createdAt: event.created_at,
  };
}

export function mapConcern(concern: any) {
  return {
    id: concern.id,
    careRoomId: concern.care_room_id,
    clientId: concern.client_id,
    title: concern.title,
    description: concern.description,
    category: concern.category,
    severity: concern.severity,
    priority: concern.priority,
    status: concern.status,
    outcome: concern.outcome,
    acknowledgementDueAt: concern.acknowledgement_due_at,
    acknowledgedAt: concern.acknowledged_at,
    responseDueAt: concern.response_due_at,
    resolutionDueAt: concern.resolution_due_at,
    resolvedAt: concern.resolved_at,
    messages: (concern.messages || []).map(mapConcernMessage),
    events: (concern.events || []).map(mapConcernEvent),
  };
}
