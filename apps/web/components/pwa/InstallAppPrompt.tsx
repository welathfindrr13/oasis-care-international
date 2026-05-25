'use client';

import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function InstallAppPrompt({ compact = false }: { compact?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const canInstall = useMemo(() => !isInstalled && Boolean(deferredPrompt), [deferredPrompt, isInstalled]);

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
      <button
        type="button"
        onClick={onInstall}
        className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors"
      >
        Install App
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900 mb-1">Install Oasis Care App</h3>
      <p className="text-sm text-slate-600 mb-3">
        Add this app to your device home screen for faster access and a full-screen experience.
      </p>

      {canInstall ? (
        <button
          type="button"
          onClick={onInstall}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors"
        >
          Install Now
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
          >
            Show Manual Install Steps
          </button>
          {showHelp && (
            <div className="mt-3 text-sm text-slate-600 space-y-1">
              <p>iPhone (Safari): tap Share, then select Add to Home Screen.</p>
              <p>Android (Chrome): open browser menu, then select Install app.</p>
              <p>Desktop (Chrome/Edge): use the install icon in the address bar.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
