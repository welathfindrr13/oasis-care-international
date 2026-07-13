import Link from 'next/link'

const careRecordJourney = [
  {
    name: 'Plan care',
    text: 'Keep assessments, care plans, review dates and agreed outcomes together.',
  },
  {
    name: 'Record each visit',
    text: 'Give carers the visit information they need and record what happened.',
  },
  {
    name: 'Review what needs attention',
    text: 'Help managers find overdue reviews, visit exceptions and records to check.',
  },
  {
    name: 'Share approved updates',
    text: 'Keep family updates and concerns separate from internal care records.',
  },
]

const secondaryLinkClass =
  'inline-flex min-h-11 items-center border-b-2 border-oasis-teal px-1 py-2 text-sm font-semibold text-oasis-teal-dark hover:border-oasis-teal-dark hover:text-oasis-teal'

export default function Home() {
  return (
    <div className="min-h-screen bg-oasis-canvas text-oasis-ink">
      <header className="border-b border-oasis-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-h-11 min-w-0 items-center gap-3 text-oasis-ink no-underline"
            aria-label="Oasis Care home"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-oasis-ink text-lg font-bold text-white"
              aria-hidden="true"
            >
              O
            </span>
            <span className="min-w-0">
              <span className="block font-heading text-base font-bold sm:text-lg">Oasis Care</span>
              <span className="block text-xs text-oasis-muted sm:text-sm">Care records for home-care teams</span>
            </span>
          </Link>
          <nav aria-label="Account">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-oasis-control-border bg-white px-4 py-2 text-sm font-semibold text-oasis-ink hover:border-oasis-teal hover:bg-oasis-teal-soft"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-oasis-border bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(19rem,0.75fr)] lg:gap-16 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold text-oasis-teal-dark">Clear records for home care</p>
              <h1 className="max-w-2xl font-heading text-4xl font-bold leading-tight tracking-tight text-oasis-ink sm:text-5xl lg:text-[3.5rem]">
                Clear care records, from plan to visit update
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-oasis-muted">
                Oasis keeps care plans, visit records, approved family updates and concern tracking in one
                workspace. Available features depend on your organisation&apos;s setup.
              </p>
              <div className="mt-8">
                <Link
                  href="/request-access"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-oasis-teal bg-oasis-teal px-5 py-3 font-semibold text-white hover:border-oasis-teal-dark hover:bg-oasis-teal-dark"
                >
                  Request company access
                </Link>
              </div>
              <div className="mt-8 border-l-4 border-oasis-border pl-4">
                <p className="text-sm font-semibold text-oasis-ink">Already have access?</p>
                <div className="mt-2 flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
                  <Link href="/today" className={secondaryLinkClass}>
                    Open Manager Today
                  </Link>
                  <Link href="/family-updates" className={secondaryLinkClass}>
                    Review family updates
                  </Link>
                </div>
              </div>
            </div>

            <aside className="border-t-4 border-oasis-teal bg-oasis-canvas p-5 sm:p-6" aria-labelledby="record-boundary-heading">
              <h2 id="record-boundary-heading" className="text-xl font-bold text-oasis-ink">
                Clear sharing boundaries
              </h2>
              <p className="mt-3 text-base leading-7 text-oasis-muted">
                Family members see approved updates made available to them. Internal care records stay within the
                care team&apos;s assigned access.
              </p>
              <p className="mt-5 border-t border-oasis-border pt-5 text-sm leading-6 text-oasis-muted">
                Use the account provided by your organisation. What you can open depends on your assigned access.
              </p>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="journey-heading">
          <div className="max-w-2xl">
            <h2 id="journey-heading" className="text-2xl font-bold text-oasis-ink sm:text-3xl">
              How the record moves through care
            </h2>
            <p className="mt-3 text-base leading-7 text-oasis-muted">
              One care record supports the work before, during and after a visit.
            </p>
          </div>
          <ol className="mt-8 grid gap-0 border-l-2 border-oasis-teal lg:grid-cols-4 lg:border-l-0 lg:border-t-2">
            {careRecordJourney.map((step, index) => (
              <li key={step.name} className="relative px-5 pb-8 last:pb-0 lg:px-6 lg:pb-0 lg:pt-8">
                <span
                  className="absolute -left-[0.8rem] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-oasis-teal bg-oasis-canvas text-xs font-bold text-oasis-teal-dark lg:-top-[0.8rem] lg:left-6"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <h3 className="text-lg font-bold text-oasis-ink">{step.name}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-oasis-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-oasis-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-oasis-muted sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} Oasis Care</p>
        </div>
      </footer>
    </div>
  )
}
