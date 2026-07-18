import { Header } from "../../../components/oasis/Header";

export default function AdminSetupLoading() {
  return (
    <div className="min-h-screen bg-oasis-canvas">
      <Header />
      <main
        className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
        aria-busy="true"
        aria-label="Loading company setup"
      >
        <div className="h-5 w-32 animate-pulse rounded bg-oasis-border motion-reduce:animate-none" />
        <div className="mt-4 h-11 max-w-md animate-pulse rounded bg-oasis-border motion-reduce:animate-none" />
        <div className="mt-5 h-6 max-w-xs animate-pulse rounded bg-oasis-border motion-reduce:animate-none" />
        <div className="mt-12 space-y-5 border-t border-oasis-border pt-6">
          {[0, 1, 2, 3].map((step) => (
            <div key={step} className="h-24 animate-pulse rounded bg-oasis-surface motion-reduce:animate-none" />
          ))}
        </div>
      </main>
    </div>
  );
}
