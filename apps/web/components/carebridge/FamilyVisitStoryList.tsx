import type { VerifiedVisitStory } from '../../lib/graphql/queries'
import { VerifiedVisitStoryCard } from './VerifiedVisitStoryCard'

interface FamilyVisitStoryListProps {
  stories: VerifiedVisitStory[]
}

export function FamilyVisitStoryList({ stories }: FamilyVisitStoryListProps) {
  if (stories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h3 className="font-heading text-xl font-semibold text-slate-900">No approved updates yet</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your agency has not published any proof-of-care stories to this Family Assurance Room yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {stories.map((story) => (
        <VerifiedVisitStoryCard key={story.id} story={story} audience="family" />
      ))}
    </div>
  )
}
