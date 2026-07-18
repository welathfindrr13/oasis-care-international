"use client";

import { Header } from "../../../components/oasis/Header";
import { Button } from "../../../components/ui/Button";

export default function AdminSetupError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-oasis-canvas">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-heading text-3xl font-bold text-oasis-ink">
          We could not load company setup
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-oasis-muted">
          Your information has not been changed. Try again to load your setup
          steps.
        </p>
        <Button onClick={reset} className="mt-8">
          Try again
        </Button>
      </main>
    </div>
  );
}
