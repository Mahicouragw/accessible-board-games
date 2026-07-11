"use client";

import { useEffect, useState } from "react";

export default function AccessibilityToolbar() {
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const savedContrast = localStorage.getItem("a11y-highContrast") === "true";
    const savedSize = parseInt(localStorage.getItem("a11y-fontSize") || "16", 10);
    setHighContrast(savedContrast);
    setFontSize(savedSize);
  }, []);

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
        </div>
      </div>
    </>
  );
}
