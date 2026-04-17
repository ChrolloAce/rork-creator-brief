"use client";

import { useEffect, useMemo, useState } from "react";
import type { VideoExample } from "@/lib/types";
import { getVideoByDbId } from "@/lib/all-videos";
import { VideoChip } from "@/components/admin/VideoChip";
import { VideoPicker } from "@/components/admin/VideoPicker";

type Curation = {
  _doc?: string;
  exclude: string[];
  formatPins: Record<string, string[]>;
  formatBuckets: Record<string, string | null>;
};

export default function AdminPage() {
  const [cur, setCur] = useState<Curation | null>(null);
  const [githubConnected, setGH] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/curation");
      const j = await r.json();
      if (j.ok) {
        setCur(j.curation);
        setGH(j.githubConnected);
      } else {
        setLoadError(j.error ?? "failed to load");
      }
    })();
  }, []);

  async function onSave() {
    if (!cur) return;
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch("/api/curation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        curation: cur,
        message: "chore(curation): admin edit",
      }),
    });
    const j = await res.json();
    setSaving(false);
    if (res.ok) {
      setSaveMsg(
        `Committed → ${j.commit?.sha?.slice(0, 7) ?? "ok"}. Railway will auto-deploy in ~90s.`
      );
    } else {
      setSaveMsg(`ERR: ${j.error ?? res.status}`);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  if (loadError) {
    return (
      <main className="p-8">
        <p className="text-sm text-[#b91c1c]">Failed to load: {loadError}</p>
      </main>
    );
  }
  if (!cur) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading curation…</p>
      </main>
    );
  }

  const formats = Object.keys(cur.formatBuckets);
  const allExcluded = new Set<string>(cur.exclude);
  // Also exclude anything already pinned to ANY format (prevents duplicate pins)
  for (const slug of formats) {
    for (const id of cur.formatPins[slug] ?? []) allExcluded.add(id);
  }

  return (
    <main className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-20 bg-background border-b-2 border-line">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Rork / Brief · Admin
            </div>
            <h1 className="text-xl font-black">Curation editor</h1>
          </div>
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 border-line rounded-sm ${
              githubConnected
                ? "bg-[#86efac] text-[#064e2f]"
                : "bg-paper text-muted"
            }`}
          >
            GitHub {githubConnected ? "connected" : "not connected"}
          </span>
          <button
            onClick={onSave}
            disabled={saving || !githubConnected}
            className="border-2 border-line bg-ink text-background font-black uppercase tracking-widest px-3 py-1.5 rounded-md nb-press disabled:opacity-40"
          >
            {saving ? "…" : "Save + Deploy"}
          </button>
          <button
            onClick={onLogout}
            className="border-2 border-line bg-background px-2 py-1.5 rounded-md nb-press text-xs font-bold uppercase tracking-widest"
          >
            Log out
          </button>
        </div>
        {saveMsg && (
          <div className="max-w-5xl mx-auto px-4 pb-3">
            <p className="text-xs font-bold border-2 border-line bg-paper px-2 py-1.5 rounded-sm">
              {saveMsg}
            </p>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
        {!githubConnected && (
          <section className="border-2 border-line bg-accent text-accent-ink rounded-md p-4 text-sm leading-relaxed">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2">
              GitHub not connected
            </div>
            You can preview changes here, but Save stays disabled until{" "}
            <code className="bg-background/30 px-1">GITHUB_TOKEN</code>,{" "}
            <code className="bg-background/30 px-1">GITHUB_OWNER</code>,{" "}
            <code className="bg-background/30 px-1">GITHUB_REPO</code> are set
            on Railway.
          </section>
        )}

        {formats.map((slug) => (
          <FormatSection
            key={slug}
            slug={slug}
            bucket={cur.formatBuckets[slug]}
            pins={cur.formatPins[slug] ?? []}
            allExcluded={allExcluded}
            onChange={(nextPins) =>
              setCur((c) =>
                c
                  ? {
                      ...c,
                      formatPins: { ...c.formatPins, [slug]: nextPins },
                    }
                  : c
              )
            }
          />
        ))}

        <ExcludeSection
          excluded={cur.exclude}
          pickerExcluded={allExcluded}
          onChange={(next) => setCur((c) => (c ? { ...c, exclude: next } : c))}
        />

        <details className="border-2 border-line rounded-md bg-paper p-3">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Raw JSON (advanced)
          </summary>
          <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap break-all">
            {JSON.stringify(cur, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}

function FormatSection({
  slug,
  bucket,
  pins,
  allExcluded,
  onChange,
}: {
  slug: string;
  bucket: string | null;
  pins: string[];
  allExcluded: Set<string>;
  onChange: (next: string[]) => void;
}) {
  const pinnedVideos = useMemo(
    () =>
      pins.map((id) => ({
        id,
        video: getVideoByDbId(id) as VideoExample | undefined,
      })),
    [pins]
  );

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <h2 className="text-lg font-black">{slug}</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
          bucket: {bucket ?? "— (pins only)"}  ·  {pins.length} pinned
        </span>
      </div>

      {pinnedVideos.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
          {pinnedVideos.map(({ id, video }) => (
            <VideoChip
              key={id}
              video={video}
              fallbackId={id}
              onRemove={() => onChange(pins.filter((x) => x !== id))}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted mb-3 italic">
          No manual pins. Format shows the bucket&rsquo;s top-12 by views.
        </p>
      )}

      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
        Add a pin
      </div>
      <VideoPicker
        excludedIds={allExcluded}
        onPick={(v) => {
          if (v.dbId && !pins.includes(v.dbId)) onChange([...pins, v.dbId]);
        }}
        placeholder="Search @creator or caption…"
      />
    </section>
  );
}

function ExcludeSection({
  excluded,
  pickerExcluded,
  onChange,
}: {
  excluded: string[];
  pickerExcluded: Set<string>;
  onChange: (next: string[]) => void;
}) {
  const videos = useMemo(
    () =>
      excluded.map((id) => ({
        id,
        video: getVideoByDbId(id) as VideoExample | undefined,
      })),
    [excluded]
  );
  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
        Exclude list (global)
      </div>
      <p className="text-xs text-muted mb-3">
        Removed from every format, regardless of bucket.
      </p>
      {videos.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
          {videos.map(({ id, video }) => (
            <VideoChip
              key={id}
              video={video}
              fallbackId={id}
              onRemove={() => onChange(excluded.filter((x) => x !== id))}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted italic mb-3">Nothing excluded.</p>
      )}
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
        Exclude a video
      </div>
      <VideoPicker
        excludedIds={pickerExcluded}
        onPick={(v) => {
          if (v.dbId && !excluded.includes(v.dbId)) onChange([...excluded, v.dbId]);
        }}
        placeholder="Search @creator or caption…"
      />
    </section>
  );
}
