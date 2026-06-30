'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { Header } from '../../../components/oasis/Header'
import { Button } from '../../../components/ui/Button'
import { clientQuery } from '../../../lib/graphql/client-side'
import {
  CAREBRIDGE_ROOMS_QUERY,
  PUBLISH_VERIFIED_VISIT_STORY_MUTATION,
  REJECT_VERIFIED_VISIT_STORY_MUTATION,
  VERIFIED_VISIT_STORY_APPROVAL_QUEUE_QUERY,
  type CareRoomsQueryResponse,
  type VerifiedVisitStory,
  type VerifiedVisitStoryApprovalQueueQueryResponse,
} from '../../../lib/graphql/queries'
import { ApprovalQueueItem } from '../../../components/carebridge/ApprovalQueueItem'

export function CareBridgeApprovalsClient() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [stories, setStories] = useState<VerifiedVisitStory[]>([])
  const [roomOptions, setRoomOptions] = useState<Array<{ id: string; label: string }>>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busyStoryId, setBusyStoryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadApprovalQueue = useCallback(async (careRoomId?: string) => {
    const [queueData, roomsData] = await Promise.all([
      clientQuery<VerifiedVisitStoryApprovalQueueQueryResponse>(
        VERIFIED_VISIT_STORY_APPROVAL_QUEUE_QUERY,
        careRoomId ? { careRoomId } : {},
        { getBearerToken: () => getToken() },
      ),
      clientQuery<CareRoomsQueryResponse>(CAREBRIDGE_ROOMS_QUERY, undefined, {
        getBearerToken: () => getToken(),
      }),
    ])

    setStories(queueData.verifiedVisitStoryApprovalQueue)
    setRoomOptions(
      roomsData.careRooms.map((room) => ({
        id: room.id,
        label: room.client.fullName,
      })),
    )
  }, [getToken])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn) {
      setLoading(false)
      setError('Unauthorized')
      return
    }

    async function bootstrap() {
      try {
        setLoading(true)
        setError(null)
        await loadApprovalQueue(selectedRoomId || undefined)
      } catch (err: any) {
        setError(err?.message || 'Failed to load the approval queue.')
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [isLoaded, isSignedIn, loadApprovalQueue, selectedRoomId])

  async function approveStory(storyId: string) {
    try {
      setBusyStoryId(storyId)
      setError(null)
      await clientQuery(PUBLISH_VERIFIED_VISIT_STORY_MUTATION, { storyId }, {
        getBearerToken: () => getToken(),
      })
      setStories((current) => current.filter((story) => story.id !== storyId))
    } catch (err: any) {
      setError(err?.message || 'Unable to approve this verified visit story.')
    } finally {
      setBusyStoryId(null)
    }
  }

  async function rejectStory(storyId: string, rejectionReason: string) {
    try {
      setBusyStoryId(storyId)
      setError(null)
      await clientQuery(REJECT_VERIFIED_VISIT_STORY_MUTATION, {
        input: {
          storyId,
          rejectionReason,
        },
      }, {
        getBearerToken: () => getToken(),
      })
      setStories((current) => current.filter((story) => story.id !== storyId))
    } catch (err: any) {
      setError(err?.message || 'Unable to return this verified visit story for changes.')
    } finally {
      setBusyStoryId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Verified Visit Story queue
              </p>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
                Approve proof-of-care updates before families see them
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Review draft visit stories, check the source references, and either approve them for family viewing or return them with clear changes.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Waiting now</p>
              <p className="mt-2 font-heading text-3xl font-bold text-slate-900">{stories.length}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-slate-900">Filter by care room</h2>
              <p className="mt-1 text-sm text-slate-600">
                Narrow the queue when you want to review one client at a time.
              </p>
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-600">
              <span>Care room</span>
              <select
                value={selectedRoomId}
                onChange={(event) => setSelectedRoomId(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                <option value="">All active rooms</option>
                {roomOptions.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="mt-6 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
              Loading approval queue...
            </div>
          ) : stories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <h2 className="font-heading text-2xl font-semibold text-slate-900">No updates waiting for review</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Draft Verified Visit Updates will appear here as visits are prepared for family-safe approval.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Button asChild variant="outline">
                  <Link href="/family-updates">Back to Family Updates</Link>
                </Button>
                <Button asChild>
                  <Link href="/people">Review people</Link>
                </Button>
              </div>
            </div>
          ) : (
            stories.map((story) => (
              <ApprovalQueueItem
                key={story.id}
                story={story}
                busy={busyStoryId === story.id}
                onApprove={approveStory}
                onReject={rejectStory}
              />
            ))
          )}
        </section>
      </main>
    </div>
  )
}
