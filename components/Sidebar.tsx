"use client";

import Link from "next/link";
import type { NavSection } from "@/lib/nav";
import type { BriefOverview } from "@/lib/db";

export function Sidebar({
  sections,
  activeId,
  brief,
  onNavigate,
  onClose,
}: {
  sections: NavSection[];
  activeId: string;
  brief: {
    slug: string;
    name: string;
    logoUrl: string | null;
    overview?: BriefOverview | null;
  };
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const briefHome = `/b/${brief.slug}`;
  const ctaLabel = brief.overview?.ctaLabel?.trim();
  const ctaUrl = brief.overview?.ctaUrl?.trim();
  return (
    <nav aria-label="Brief sections" className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b-2 border-line">
        <Link
          href={briefHome}
          onClick={onNavigate}
          className="w-10 h-10 border-2 border-line bg-background rounded-md nb-shadow-sm overflow-hidden flex items-center justify-center"
          aria-label={`Home — ${brief.name} Creator Brief`}
        >
          {brief.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={brief.logoUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-base font-black uppercase">
              {brief.name.slice(0, 2)}
            </span>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-black text-ink leading-tight text-sm truncate">
            {brief.name.toUpperCase()} / BRIEF
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-bold">
            Creator guide
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden w-9 h-9 border-2 border-line bg-background rounded-md flex items-center justify-center font-black nb-press"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted px-2 mb-2">
              {section.label}
            </div>
            <ul className="space-y-1.5">
              {section.items.map((it) => {
                const active = activeId === it.id;
                return (
                  <li key={it.id}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`block border-2 border-line rounded-md px-2.5 py-2 flex items-center gap-2.5 transition-[transform,box-shadow,background-color] ${
                        active
                          ? "bg-accent text-accent-ink nb-shadow-sm"
                          : "bg-background text-ink hover:bg-paper nb-press"
                      }`}
                    >
                      {it.thumbnail && (
                        <span className="w-9 h-9 border-2 border-line bg-paper overflow-hidden rounded-sm shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={it.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-sm leading-tight truncate">
                          {it.title}
                        </span>
                        {it.meta && (
                          <span
                            className={`block text-[11px] mt-0.5 truncate ${
                              active ? "text-accent-ink/80" : "text-muted"
                            }`}
                          >
                            {it.meta}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {ctaLabel && ctaUrl && (
        <div className="p-3 border-t-2 border-line">
          <a
            href={ctaUrl}
            target="_blank"
            rel="noreferrer"
            className="block border-2 border-line bg-background rounded-md px-3 py-2 text-center font-bold text-sm nb-press"
          >
            {ctaLabel} ↗
          </a>
        </div>
      )}
    </nav>
  );
}
