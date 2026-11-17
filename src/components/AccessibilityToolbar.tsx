"use client";

import { useEffect, useState } from "react";
import { LANGS, getLanguage, setLanguage, type Lang } from "@/lib/i18n";
import { sound } from "@/lib/sound";

export default function AccessibilityToolbar() {
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [announce, setAnnounce] = useState("");
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const savedContrast = localStorage.getItem("a11y-highContrast") === "true";
    const savedSize = parseInt(localStorage.getItem("a11y-fontSize") || "16", 10);
    setHighContrast(savedContrast);
    setFontSize(savedSize);
    setLang(getLanguage());
  }, []);

  const changeLanguage = (l: Lang) => {
    setLang(l);
    setLanguage(l);
    const label = LANGS.find((x) => x.id === l);
    speak(`Narration language: ${label?.native ?? l}`);
    sound.speak(`Narration language: ${label?.native ?? l}`);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", highContrast ? "high-contrast" : "light");
    document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
    localStorage.setItem("a11y-highContrast", String(highContrast));
    localStorage.setItem("a11y-fontSize", String(fontSize));
  }, [highContrast, fontSize]);

  const speak = (msg: string) => {
    setAnnounce(msg);
    setTimeout(() => setAnnounce(""), 100);
  };

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
      <div className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-4 py-2 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold">♿ Accessible Board Games</span>
          <span className="hidden md:inline text-slate-400">| Keyboard: Tab + Enter | Screen Reader Ready</span>
          <a
            href="https://accessible-board-games.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline rounded-lg border border-sky-700 bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-300 underline hover:bg-sky-500/30"
            aria-label="Open the live site in a new tab"
          >
            🌐 Live site ↗
          </a>
        </div>
        <div className="a11y-toolbar" role="toolbar" aria-label="Accessibility controls">
          <button
            aria-pressed={highContrast}
            onClick={() => {
              const v = !highContrast;
              setHighContrast(v);
              speak(v ? "High contrast enabled" : "High contrast disabled");
            }}
            title="Toggle high contrast for low vision"
          >
            {highContrast ? "☀️ Normal" : "🌑 High Contrast"}
          </button>
          <button
            onClick={() => {
              const ns = Math.min(22, fontSize + 2);
              setFontSize(ns);
              speak(`Font size ${ns}`);
            }}
            aria-label="Increase font size"
          >
            A+
          </button>
          <button
            onClick={() => {
              const ns = Math.max(14, fontSize - 2);
              setFontSize(ns);
              speak(`Font size ${ns}`);
            }}
            aria-label="Decrease font size"
          >
            A-
          </button>
          <button
            onClick={() => {
              setFontSize(16);
              setHighContrast(false);
              speak("Accessibility reset");
            }}
            aria-label="Reset accessibility settings"
          >
            Reset
          </button>
          <label className="flex items-center gap-1 text-xs text-slate-400">
            🗣️
            <span className="sr-only">Narration language</span>
            <select
              aria-label="Narration language (English, Telugu, Hindi)"
              value={lang}
              onChange={(e) => changeLanguage(e.target.value as Lang)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.native}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </>
  );
}
