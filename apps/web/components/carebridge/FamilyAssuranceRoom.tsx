import Link from 'next/link'
import type { CarebridgeRoom, VerifiedVisitStory } from '../../lib/graphql/queries'
import { Button } from '../ui/Button'
import { FamilyVisitStoryList } from './FamilyVisitStoryList'

interface FamilyAssuranceRoomProps {
  room: CarebridgeRoom
  stories: VerifiedVisitStory[]
}

export function FamilyAssuranceRoom({ room, stories }: FamilyAssuranceRoomProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-8 shadow-sm">
        <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
          Family updates
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
          {room.client.fullName}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Read the updates the care team has approved for family viewing. These explain what happened and what changed
          without showing private staff notes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="ghost">
            <Link href="/family">Back to family home</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Updates published</p>
          <p className="mt-3 font-heading text-3xl font-bold text-slate-900">{stories.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Concern access</p>
          <p className="mt-3 text-sm font-medium text-slate-700">
            {room.policy?.familyCanRaiseConcerns ? 'Enabled by your agency' : 'Not enabled for this room'}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sharing boundary</p>
          <p className="mt-3 text-sm font-medium text-slate-700">
            Approved family-safe updates only
          </p>
        </article>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-heading text-2xl font-semibold text-slate-900">Approved care updates</h2>
          <p className="mt-1 text-sm text-slate-600">
            Each update below has been reviewed for family viewing before publication.
          </p>
        </div>
        <FamilyVisitStoryList stories={stories} />
      </section>
    </div>
  )
}
