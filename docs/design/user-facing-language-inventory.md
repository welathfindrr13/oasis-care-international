# User-facing language inventory

Snapshot: 2026-07-12

This inventory covers the product terms called out in the role-experience correction. It separates implementation names that users cannot see from rendered copy that must change. Line numbers are intentionally omitted because the role-specific UI work will move this copy; file paths are the stable review key.

## User-facing and must be replaced

| Current term | Rendered locations | Required plain-language direction |
| --- | --- | --- |
| `Today Command Centre` | `app/login/page.tsx`, `app/page.tsx` | `Today` |
| `Proof-led care OS`, `proof-led care`, `spine for proof-led care` | `app/page.tsx`, `app/care-planning/page.tsx` | Describe the agency work Oasis helps with in ordinary language. |
| `Workforce login`, `workforce logins`, `assignment readiness` | `app/admin/carers/page.tsx`, `app/admin/carers/CarerLifecycleClient.tsx`, `app/admin/carers/CarerMembershipLinkForm.tsx` | `Carer account`, `Carer accounts`, `Ready to schedule` |
| `Family Assurance Room`, `Family Assurance rooms`, `proof-of-care` | `app/family/page.tsx`, `app/family/care-rooms/[id]/page.tsx`, `app/carebridge/page.tsx`, `app/clients/[id]/carebridge/page.tsx`, `app/dashboard/page.tsx`, `app/carebridge/approvals/CareBridgeApprovalsClient.tsx`, `components/carebridge/FamilyVisitStoryList.tsx`, `components/carebridge/FamilyAssuranceRoom.tsx` | `Updates about [person]`, `Family updates`, or a direct description of the approval task. |
| `Verified Visit Story`, `verified visit story`, `verified visit stories` | `app/carebridge/approvals/CareBridgeApprovalsClient.tsx`, `app/clients/[id]/carebridge/page.tsx`, `components/carebridge/VerifiedVisitStoryCard.tsx` | `Family update` or `Family updates` |
| `Verified Visit Update`, `Verified Visit Updates` | `app/carebridge/page.tsx`, `app/carebridge/approvals/CareBridgeApprovalsClient.tsx`, `app/clients/[id]/carebridge/page.tsx` | `Family update` or `Family updates` |
| `Evidence pack`, `evidence packs` in screens and action feedback | `app/care-planning/page.tsx`, `app/management/page.tsx`, `app/clients/[id]/page.tsx`, `app/evidence/page.tsx`, `components/care-planning/CarePlanningActions.tsx` | `Care records` or `Inspection records`, selected from the task context. |
| `care spine` in action feedback | `components/care-planning/CarePlanningActions.tsx` | Never render this architecture term; say which page or records are refreshing. |

## Internal-only and acceptable

These occurrences are code/schema contracts rather than rendered product language. Renaming them would be a separate API migration and is not required to fix first-use clarity.

| Internal term | Locations |
| --- | --- |
| Care-room and verified-story GraphQL operation/type/field names | `lib/graphql/queries.ts` |
| Care-room response fixture and query strings | `lib/graphql/client-side.test.ts` |
| Helper, component, type, variable, and prop identifiers containing `CareRoom`, `careRoom`, `CareRooms`, or `VerifiedVisitStory` | `app/family/page.tsx`, `app/family/care-rooms/[id]/page.tsx`, `app/carebridge/page.tsx`, `app/carebridge/approvals/CareBridgeApprovalsClient.tsx`, `app/clients/[id]/carebridge/page.tsx`, `components/carebridge/FamilyAssuranceRoom.tsx`, `components/carebridge/VerifiedVisitStoryCard.tsx` |
| Route folder `/family/care-rooms/[id]` | `app/family/care-rooms/[id]/` |
| Test-only variable and assertion language | `components/oasis/headerNavigation.test.ts`, `app/admin/carers/admin-carer-linking.test.mjs` |

Internal names are acceptable only while they stay out of headings, labels, help text, errors, empty states, URLs shown as copy, analytics event labels shown to users, and exported documents.

## Uncertain and requiring product or regulatory evidence

| Occurrence | Why evidence is needed | Default until resolved |
| --- | --- | --- |
| `components/evidence/EvidencePackPdf.tsx` | This generates an inspection-facing artifact. Confirm whether an existing policy, regulator workflow, or customer contract formally names the artifact before choosing `Care records` versus `Inspection records`. | Do not expose it to pilot users until its terminology and contents are approved. |
| `app/api/evidence-packs/[id]/export/route.ts` response messages | Some messages may reach an administrator; others are server logs. The API response and log wording should be separated before renaming. | User-visible responses should say `Inspection records`; internal logs may retain the model name. |
| Evidence creation audit/summary strings in `components/care-planning/CarePlanningActions.tsx` | Some values may be persisted as internal audit detail while adjacent strings are rendered status messages. | Rendered feedback must use plain language; retain internal model wording only in non-user-visible audit data. |

## Completed in the capability boundary change

- The Admin landing heading and metadata now use `Today`.
- The Admin attention card uses `Care records to review` instead of `Evidence gaps`.
- Carer/staff `/today` no longer renders the management dashboard and uses only plain shift and assigned-visit language.

The dedicated Carer, Family, and Admin experience PRs must clear the remaining user-facing rows and add source tests so these terms cannot re-enter rendered copy.
