import Link from 'next/link'
import { Header } from '../../../../components/oasis/Header'
import { buttonVariants } from '../../../../components/ui/Button'
import MedicationForm from './MedicationForm'

export const dynamic = 'force-dynamic'

export default function NewMedicationPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/admin/medications" className="text-slate-500 hover:text-slate-700">
                Medication Library
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="font-medium text-slate-900">Add Medication</li>
          </ol>
        </nav>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Add Medication</h1>
            <p className="mt-1 text-slate-500">
              Build the medication library your admin team can assign to clients.
            </p>
          </div>
          <Link href="/admin/medications" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to library
          </Link>
        </div>

        <MedicationForm />
      </main>
    </div>
  )
}
