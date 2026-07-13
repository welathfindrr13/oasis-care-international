import Link from 'next/link'

const pillars = [
  {
    name: 'Plan',
    text: 'Assessment-led care plans, review dates, risks, preferences, and clear outcomes.',
  },
  {
    name: 'Deliver',
    text: 'Guided visit records, care actions, and notes kept together.',
  },
  {
    name: 'Prove',
    text: 'Managers can review operational records and prepare information for inspections.',
  },
  {
    name: 'Reassure',
    text: 'Approved family updates and concern cases keep relatives informed without showing internal care records.',
  },
  {
    name: 'Improve',
    text: 'Manager Today brings together exceptions, overdue reviews, and records that need attention.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f2ea] text-slate-950">
      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.20),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(15,118,110,0.16),transparent_24%),linear-gradient(135deg,#fbf7ef_0%,#eef8f5_52%,#f6f2ea_100%)]" />
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-xl shadow-teal-900/20">
              O
            </div>
            <div>
              <p className="font-heading text-lg font-black tracking-tight">Oasis Care</p>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-800">
                Care records for home-care teams
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="whitespace-nowrap rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur hover:border-teal-500 hover:text-teal-800"
          >
            Sign in
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-teal-200 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-teal-800 shadow-sm">
              Clear records for home care
            </p>
            <h1 className="font-heading text-5xl font-black leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl">
              Keep care plans, visits and updates clear.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              Oasis brings care planning, visit records, approved family updates and concern tracking into one
              workspace. Available features depend on your organisation&apos;s setup.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/request-access"
                className="rounded-full bg-teal-700 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-teal-900/20 hover:bg-teal-800"
              >
                Request company access
              </Link>
              <Link
                href="/today"
                className="rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-bold text-slate-800 shadow-sm backdrop-blur hover:border-teal-500 hover:text-teal-800"
              >
                Open Manager Today
              </Link>
              <Link
                href="/family-updates"
                className="rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-bold text-slate-800 shadow-sm backdrop-blur hover:border-sky-400 hover:text-sky-800"
              >
                Review family updates
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur">
            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal-200">Core loop</p>
              <div className="mt-5 space-y-3">
                {['Assess need', 'Approve care plan', 'Guide visit', 'Record once', 'Publish approved update', 'Resolve concern', 'Preserve evidence'].map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl bg-white/8 p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-400/20 text-sm font-black text-teal-100">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-3 pb-10 md:grid-cols-5">
          {pillars.map((pillar) => (
            <article key={pillar.name} className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
              <h2 className="font-heading text-xl font-black tracking-tight text-slate-950">{pillar.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.text}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
