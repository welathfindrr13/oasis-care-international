"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    )
  );
}

export function InstallAppPrompt({ compact = false }: { compact?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneMode());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const canInstall = useMemo(
    () => !isInstalled && Boolean(deferredPrompt),
    [deferredPrompt, isInstalled],
  );

  const onInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  if (compact) {
    if (!canInstall) return null;
    return (
      <Button type="button" onClick={onInstall} size="sm">
        Install app
      </Button>
    );
  }

  return (
    <section
      className="oasis-panel p-5 sm:p-6"
      aria-labelledby="install-oasis-title"
    >
      <h2
        id="install-oasis-title"
        className="text-lg font-semibold text-oasis-ink"
      >
        Install Oasis Care
      </h2>
      <p className="mt-2 text-sm leading-6 text-oasis-muted">
        Add this secure workspace to your device for quicker access. You can
        also keep using it in your browser.
      </p>

      <div className="mt-4">
        {canInstall ? (
          <Button type="button" onClick={onInstall}>
            Install app
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowHelp((prev) => !prev)}
            aria-expanded={showHelp}
            aria-controls="manual-install-help"
          >
            {showHelp ? "Hide install steps" : "Show manual install steps"}
          </Button>
        )}
      </div>

      {!canInstall && showHelp && (
        <div
          id="manual-install-help"
          className="mt-4 space-y-2 text-sm leading-6 text-oasis-muted"
        >
          <p>iPhone or iPad (Safari): use Share, then Add to Home Screen.</p>
          <p>
            Android (Chrome): open the browser menu, then choose Install app.
          </p>
          <p>
            Desktop (Chrome or Edge): use the install control in the address
            bar.
          </p>
        </div>
      )}
    </section>
  );
}
