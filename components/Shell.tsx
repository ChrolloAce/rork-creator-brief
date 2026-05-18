"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Format, HookCategory } from "@/lib/types";
import { buildNavSections } from "@/lib/nav";
import { Sidebar } from "./Sidebar";
import { FormatView, OverviewView } from "./Views";

export function Shell({
  formats,
  hookCategories,
  activeId,
  brief,
  useAllHooks = false,
  publicStats,
}: {
  formats: Format[];
  hookCategories: HookCategory[];
  activeId: string;
  brief: {
    slug: string;
    name: string;
    logoUrl: string | null;
    overview?: import("@/lib/db").BriefOverview | null;
  };
  useAllHooks?: boolean;
  publicStats?: { enabled: boolean; visible?: string[] };
}) {
  const sections = useMemo(
    () => buildNavSections(formats, brief.slug),
    [formats, brief.slug]
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Close drawer on escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Lock body scroll while drawer open on mobile
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [drawerOpen]);

  const currentTitle = useMemo(() => {
    for (const s of sections) {
      const it = s.items.find((i) => i.id === activeId);
      if (it) return it.title;
    }
    return "Overview";
  }, [sections, activeId]);

  const view = renderView(activeId, formats, hookCategories, brief, useAllHooks, publicStats);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-background border-b-2 border-line">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="w-10 h-10 border-2 border-line bg-background rounded-md flex items-center justify-center nb-press"
        >
          <span className="sr-only">Open menu</span>
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
            <rect y="0" width="18" height="2.5" fill="currentColor" />
            <rect y="5.75" width="18" height="2.5" fill="currentColor" />
            <rect y="11.5" width="18" height="2.5" fill="currentColor" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 border-2 border-line bg-background rounded-md overflow-hidden shrink-0 flex items-center justify-center">
            {brief.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={brief.logoUrl}
                alt={brief.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span
                className="text-xs font-black uppercase"
                aria-label={brief.name}
              >
                {brief.name.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted leading-none">
              {brief.name} / Brief
            </div>
            <div className="font-black text-sm truncate leading-tight mt-0.5">
              {currentTitle}
            </div>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu backdrop"
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-ink/40"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[88%] max-w-sm
          bg-background border-r-2 border-line
          transform transition-transform duration-200 ease-out
          ${drawerOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:w-80 lg:shrink-0 lg:h-screen lg:sticky lg:top-0
        `}
      >
        <Sidebar
          sections={sections}
          activeId={activeId}
          brief={brief}
          onClose={() => setDrawerOpen(false)}
        />
      </aside>

      <main
        id="main-content"
        className="flex-1 min-w-0"
        role="main"
        aria-label={currentTitle}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
          {view}
        </div>
        <footer className="border-t-2 border-line mt-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-5 text-xs text-muted flex justify-between items-center">
            <span className="font-bold uppercase tracking-widest">
              Rork Creator Brief
            </span>
            <span>Built for the team</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function renderView(
  activeId: string,
  formats: Format[],
  hookCategories: HookCategory[],
  brief: {
    name: string;
    overview?: import("@/lib/db").BriefOverview | null;
  },
  useAllHooks: boolean,
  publicStats?: { enabled: boolean; visible?: string[] }
) {
  if (activeId === "overview")
    return (
      <OverviewView
        briefName={brief.name}
        overview={brief.overview ?? null}
      />
    );
  if (activeId.startsWith("format:")) {
    const slug = activeId.slice("format:".length);
    const f = formats.find((x) => x.slug === slug);
    if (f)
      return (
        <FormatView
          format={f}
          hookCategories={hookCategories}
          useAllHooks={useAllHooks}
          publicStats={publicStats}
        />
      );
  }
  return (
    <OverviewView briefName={brief.name} overview={brief.overview ?? null} />
  );
}
