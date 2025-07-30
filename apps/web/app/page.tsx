export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Oasis International Care</h1>
      <p className="mt-4 text-lg">Domiciliary care management platform</p>
      <a
        href="/activity"
        className="mt-8 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        View Activity Dashboard
      </a>
    </main>
  )
}
