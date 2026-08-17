"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

// EN/ES switch. Writes the sb_lang cookie and re-renders the server page so
// both the UI chrome and the translated content swap together. The first
// switch to Spanish on a brief can take a few seconds while the translation
// is generated (it's cached after that), hence the busy state.
export function LanguageToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Lang | null>(null);
  function set(l: Lang) {
    if (l === lang || busy) return;
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    setBusy(l);
    router.refresh();
  }
  const btn = (l: Lang, label: string) => (
    <button
      type="button"
      onClick={() => set(l)}
      aria-pressed={lang === l}
      className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
        lang === l
          ? "bg-accent text-accent-ink"
          : "bg-background text-muted hover:text-ink"
      }`}
    >
      {busy === l ? "…" : label}
    </button>
  );
  return (
    <span className="inline-flex border-2 border-line rounded-sm overflow-hidden">
      {btn("en", "EN")}
      <span className="border-l-2 border-line" aria-hidden />
      {btn("es", "ES")}
    </span>
  );
}
