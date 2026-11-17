"use client";

/**
 * Narration language setting — English / Telugu / Hindi.
 * Persisted in localStorage and used for spoken instructions (speechSynthesis
 * lang) and for TalkBack live-region announcements.
 */

export type Lang = "en" | "te" | "hi";

export const LANGS: { id: Lang; label: string; native: string; speech: string }[] = [
  { id: "en", label: "English", native: "English", speech: "en-IN" },
  { id: "te", label: "Telugu", native: "తెలుగు", speech: "te-IN" },
  { id: "hi", label: "Hindi", native: "हिन्दी", speech: "hi-IN" },
];

const KEY = "arcade_language";

export function getLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "en" || saved === "te" || saved === "hi") return saved;
  const nav = (navigator.language || "en").toLowerCase();
  if (nav.startsWith("te")) return "te";
  if (nav.startsWith("hi")) return "hi";
  return "en";
}

export function setLanguage(lang: Lang) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, lang);
  document.documentElement.setAttribute("lang", lang === "en" ? "en" : lang === "te" ? "te" : "hi");
  window.dispatchEvent(new CustomEvent("arcade:language", { detail: lang }));
}

/** BCP-47 tag passed to SpeechSynthesisUtterance. */
export function speechLang(lang: Lang = getLanguage()): string {
  return LANGS.find((l) => l.id === lang)?.speech ?? "en-IN";
}

/** Pick a translated string: t({ en: "...", te: "...", hi: "..." }) */
export function t(dict: Partial<Record<Lang, string>>): string {
  const lang = getLanguage();
  return dict[lang] ?? dict.en ?? "";
}
