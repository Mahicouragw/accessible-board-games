"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pv_install_dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  // Register the service worker.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
  }, []);

  // Capture the install prompt.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[min(90vw,20rem)]">
      <div className="animate-pieceIn rounded-2xl border border-violet-500/50 bg-slate-900 p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="PlayVerse" className="h-10 w-10 rounded-xl" />
          <div className="flex-1">
            <div className="font-bold">Install PlayVerse</div>
            <div className="text-xs text-slate-400">Add to your home screen to play like an app.</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={install}
            className="flex-1 rounded-xl bg-violet-500 px-4 py-2 font-bold text-white transition hover:bg-violet-400"
          >
            Install
          </button>
          <button
            onClick={dismiss}
            className="rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
