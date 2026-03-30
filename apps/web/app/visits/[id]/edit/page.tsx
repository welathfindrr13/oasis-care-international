import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '../../../../components/oasis/Header'
import { query } from '../../../../lib/graphql/client'
import {
  CARERS_QUERY,
  VISIT_QUERY,
  type CarersQueryResponse,
  type VisitQueryResponse,
} from '../../../../lib/graphql/queries'
import { requireAdminSession } from '../../../../lib/auth/require-admin'
import VisitEditForm from './VisitEditForm'

export const metadata: Metadata = {
  title: 'Edit Visit - Oasis Care',
  description: 'Reschedule, reassign, or cancel a care visit',
}

export const dynamic = 'force-dynamic'

interface VisitEditPageProps {
  params: {
    id: string
  }
}

async function getVisit(id: string) {
  try {
    const response = await query<VisitQueryResponse>(VISIT_QUERY, { id })
    return response.visit
  } catch (error) {
    console.error('Failed to fetch visit for edit:', error)
    return null
  }
}

async function getCarers() {
  try {
    const response = await query<CarersQueryResponse>(CARERS_QUERY, { activeOnly: true })
    return response.carers
  } catch (error) {
    console.error('Failed to fetch carers for visit edit:', error)
    return []
  }
}

export default async function VisitEditPage({ params }: VisitEditPageProps) {
  await requireAdminSession()

  const [visit, carers] = await Promise.all([getVisit(params.id), getCarers()])

  if (!visit) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-2">
              <li>
                <Link href="/visits" className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Visits
                </Link>
              </li>
              <li className="text-slate-300">/</li>
              <li>
                <Link href={`/visits/${visit.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Visit Detail
                </Link>
              </li>
              <li className="text-slate-300">/</li>
              <li className="text-sm font-medium text-slate-900">Edit</li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900 font-heading">
            Edit Visit
          </h1>
          <p className="text-slate-500 mt-1">
            Keep the live visit record accurate without removing care evidence.
          </p>
        </div>

        <VisitEditForm carers={carers} visit={visit} />
      </main>
    </div>
  )
}
