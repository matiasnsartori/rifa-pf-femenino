"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "rifa-pf:install-dismissed";

export function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    const ios =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (ios) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- platform capability read on mount
      setIsIOS(true);
      setShow(true);
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setShow(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferred(null);
  }

  if (!show) return null;

  return (
    <div className="animate-rise flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <span aria-hidden="true" className="text-2xl">📲</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">Instalá la app en el celu</p>
        {isIOS && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tocá Compartir y después “Agregar a inicio”.
          </p>
        )}
      </div>
      {!isIOS && (
        <button
          type="button"
          onClick={install}
          className="min-h-[44px] touch-manipulation rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Instalar
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="No mostrar más"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
