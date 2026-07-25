import { Header } from "../../../../components/oasis/Header";
import { StatePanel } from "../../../../components/ui/StatePanel";

export default function FamilyCareRoomLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="font-heading text-2xl font-semibold text-oasis-ink">
          Family updates
        </h1>
        <StatePanel
          className="mt-6"
          kind="loading"
          title="Loading family updates"
        >
          <p>We are checking your approved updates and concerns.</p>
        </StatePanel>
      </main>
    </div>
  );
}
