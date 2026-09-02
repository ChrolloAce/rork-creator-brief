"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { thumbSrc } from "@/lib/thumb";

// The research loop, in the order you actually work it:
//   pick/create a ViewTrack project → feed it accounts and links →
//   read what those posts are doing → write a script off the winners.
// Everything ViewTrack-side happens through /api/vt/*, which holds the key
// server-side; nothing here ever sees it.

export type VtProject = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  accountCount: number;
  videoCount: number;
};

type VtVideo = {
  id: string;
  url: string;
  platform: "instagram" | "tiktok" | "x" | "youtube";
  thumbnail: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  uploadDate: string | null;
  creator: string;
  transcriptStatus: string;
};

type VtAnalysis = {
  transcript?: string | null;
  summary?: string;
  hook?: string;
  tone?: string;
  pacing?: string;
  topics?: string[];
  whatWorked?: string[];
  suggestions?: string[];
};

export type SavedTranscript = {
  videoId: string;
  transcript: string | null;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
};

type Detail = {
  transcript: string | null;
  transcriptStatus: string;
  analysis: VtAnalysis | null;
  analysisError: string | null;
  loading: boolean;
  analyzing: boolean;
};

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X" },
] as const;

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function PanelTitle({ step, children, meta }: { step: number; children: React.ReactNode; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 border-2 border-line rounded-sm bg-ink text-background text-[10px] font-black flex items-center justify-center">
          {step}
        </span>
        <span className="text-xs font-black uppercase tracking-widest">{children}</span>
      </div>
      {meta && <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{meta}</span>}
    </div>
  );
}

export function ResearchTab({
  scopedProjectIds,
  onChangeScoped,
  onSaveScript,
}: {
  scopedProjectIds: string[];
  onChangeScoped: (next: string[]) => void;
  // Hands a finished script back to the brief, which creates a real section
  // for it and opens the studio.
  onSaveScript: (name: string, body: string) => void | Promise<void>;
}) {
  const [projects, setProjects] = useState<VtProject[] | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  // Bumped to re-pull the project list after a create or an ingest.
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vt/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) {
          setProjects(j.projects as VtProject[]);
          setProjectsError(null);
        } else setProjectsError(j.error ?? "Could not load projects");
      })
      .catch((e) => !cancelled && setProjectsError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Derived, not stored: until you pick one, the tab opens on the first
  // project already feeding this brief so you land on the work in progress.
  const active = useMemo(() => {
    if (chosen) return chosen;
    if (!projects || projects.length === 0) return null;
    return (projects.find((p) => scopedProjectIds.includes(p.id)) ?? projects[0]).id;
  }, [chosen, projects, scopedProjectIds]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Build a swipe file in ViewTrack, read what those posts are actually doing, then
        write against it. Adding accounts and links runs real scrapes on your ViewTrack
        plan.
      </p>

      <ProjectsPanel
        projects={projects}
        error={projectsError}
        active={active}
        onActivate={setChosen}
        scoped={scopedProjectIds}
        onToggleScoped={(id) =>
          onChangeScoped(
            scopedProjectIds.includes(id)
              ? scopedProjectIds.filter((x) => x !== id)
              : [...scopedProjectIds, id]
          )
        }
        onCreated={(p) => {
          refresh();
          setChosen(p.id);
        }}
      />

      {active && (
        <SourcesPanel key={`src-${active}`} projectId={active} onIngested={refresh} />
      )}
      {/* Keyed on the project so switching gives a clean panel instead of
          needing an effect to reset selections and open cards. */}
      {active && (
        <VideosPanel
          key={`vids-${active}`}
          projectId={active}
          onSaveScript={onSaveScript}
        />
      )}
    </div>
  );
}

/* ------------------------------ 1. Projects ------------------------------ */

function ProjectsPanel({
  projects,
  error,
  active,
  onActivate,
  scoped,
  onToggleScoped,
  onCreated,
}: {
  projects: VtProject[] | null;
  error: string | null;
  active: string | null;
  onActivate: (id: string) => void;
  scoped: string[];
  onToggleScoped: (id: string) => void;
  onCreated: (p: VtProject) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/vt/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color: "#f97316" }),
      }).then((x) => x.json());
      if (!r.ok) setErr(r.error ?? "Could not create the project");
      else {
        setName("");
        setOpen(false);
        onCreated(r.project as VtProject);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-3">
      <PanelTitle step={1} meta={`${scoped.length} feeding this brief`}>
        ViewTrack projects
      </PanelTitle>

      {error && <p className="text-xs text-[#b91c1c] font-bold mb-2">{error}</p>}
      {!projects ? (
        <p className="text-xs text-muted">Loading projects…</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
          {projects.map((p) => {
            const on = p.id === active;
            const isScoped = scoped.includes(p.id);
            return (
              <div
                key={p.id}
                className={`border-2 rounded-md p-2 ${on ? "border-accent bg-paper" : "border-line bg-background"}`}
              >
                <button
                  type="button"
                  onClick={() => onActivate(p.id)}
                  className="w-full text-left nb-press"
                >
                  <span className="block font-black text-sm leading-tight line-clamp-2">
                    {p.name}
                  </span>
                  <span className="block text-[10px] font-bold text-muted mt-0.5">
                    {p.accountCount} accounts · {compact(p.videoCount)} videos
                  </span>
                </button>
                <label className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isScoped}
                    onChange={() => onToggleScoped(p.id)}
                    className="w-3.5 h-3.5 accent-[#f97316]"
                  />
                  <span className={isScoped ? "" : "text-muted"}>Feeds this brief</span>
                </label>
              </div>
            );
          })}

          {open ? (
            <div className="border-2 border-dashed border-accent rounded-md p-2 space-y-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="Project name"
                className="w-full border-2 border-line bg-background rounded-sm px-2 py-1 text-xs font-bold"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void create()}
                  disabled={busy || !name.trim()}
                  className="flex-1 border-2 border-line bg-accent text-accent-ink rounded-sm py-1 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="border-2 border-line bg-background rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-widest nb-press"
                >
                  ✕
                </button>
              </div>
              {err && <p className="text-[10px] text-[#b91c1c] font-bold">{err}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="border-2 border-dashed border-line rounded-md p-2 nb-press text-muted hover:text-accent hover:border-accent flex flex-col items-center justify-center gap-0.5 min-h-[72px]"
            >
              <span className="text-lg font-black leading-none">+</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                New project
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------- 2. Sources ------------------------------ */

function SourcesPanel({
  projectId,
  onIngested,
}: {
  projectId: string;
  onIngested: () => void;
}) {
  const [mode, setMode] = useState<"account" | "links">("account");
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["id"]>("instagram");
  const [maxVideos, setMaxVideos] = useState(25);
  const [links, setLinks] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ ok: boolean; text: string }[]>([]);

  async function addAccount() {
    if (!username.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/vt/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, platform, projectId, maxVideos }),
      }).then((x) => x.json());
      setLog((l) => [
        r.ok
          ? {
              ok: true,
              text:
                r.account?.message ??
                `@${username.replace(/^@/, "")} queued — ViewTrack is pulling its posts now.`,
            }
          : { ok: false, text: r.error ?? "Could not add that account" },
        ...l,
      ]);
      if (r.ok) {
        setUsername("");
        onIngested();
      }
    } catch (e) {
      setLog((l) => [{ ok: false, text: (e as Error).message }, ...l]);
    } finally {
      setBusy(false);
    }
  }

  async function addLinks() {
    const urls = links
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));
    if (urls.length === 0 || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/vt/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls, projectId }),
      }).then((x) => x.json());
      if (!r.ok) {
        setLog((l) => [{ ok: false, text: r.error ?? "Could not add those links" }, ...l]);
      } else {
        const failed = (r.results as { url: string; ok: boolean; error?: string }[]).filter(
          (x) => !x.ok
        );
        setLog((l) => [
          { ok: true, text: `Added ${r.added} of ${urls.length} links.` },
          ...failed.map((f) => ({ ok: false, text: `${f.url} — ${f.error}` })),
          ...l,
        ]);
        if (r.added > 0) {
          setLinks("");
          onIngested();
        }
      }
    } catch (e) {
      setLog((l) => [{ ok: false, text: (e as Error).message }, ...l]);
    } finally {
      setBusy(false);
    }
  }

  const linkCount = links.split(/[\s,]+/).filter((s) => /^https?:\/\//i.test(s.trim())).length;

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-3">
      <PanelTitle step={2} meta="runs a real scrape">
        Feed the project
      </PanelTitle>

      <div className="flex gap-1.5 mb-2.5">
        {(["account", "links"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`border-2 border-line rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-widest nb-press ${
              mode === m ? "bg-ink text-background" : "bg-background"
            }`}
          >
            {m === "account" ? "Track an account" : "Paste links"}
          </button>
        ))}
      </div>

      {mode === "account" ? (
        <div className="flex gap-1.5 flex-wrap items-center">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as typeof platform)}
            className="border-2 border-line bg-background rounded-sm px-2 py-1.5 text-xs font-bold"
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addAccount()}
            placeholder="@username"
            className="flex-1 min-w-[160px] border-2 border-line bg-background rounded-sm px-2 py-1.5 text-xs font-bold"
          />
          <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted">
            Last
            <input
              type="number"
              min={1}
              max={200}
              value={maxVideos}
              onChange={(e) => setMaxVideos(Number(e.target.value) || 25)}
              className="w-14 border-2 border-line bg-background rounded-sm px-1 py-1 text-xs font-bold text-center"
            />
            posts
          </label>
          <button
            type="button"
            onClick={() => void addAccount()}
            disabled={busy || !username.trim()}
            className="border-2 border-line bg-accent text-accent-ink rounded-sm px-3 py-1.5 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-50"
          >
            {busy ? "Adding…" : "Track"}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={3}
            placeholder="Paste video links, one per line"
            className="w-full border-2 border-line bg-background rounded-sm px-2 py-1.5 text-xs font-bold"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
              {linkCount} link{linkCount === 1 ? "" : "s"} detected
            </span>
            <button
              type="button"
              onClick={() => void addLinks()}
              disabled={busy || linkCount === 0}
              className="border-2 border-line bg-accent text-accent-ink rounded-sm px-3 py-1.5 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-50"
            >
              {busy ? "Adding…" : `Add ${linkCount || ""}`}
            </button>
          </div>
        </div>
      )}

      {log.length > 0 && (
        <ul className="mt-2 space-y-1 max-h-28 overflow-y-auto">
          {log.map((l, i) => (
            <li
              key={i}
              className={`text-[11px] font-bold ${l.ok ? "text-muted" : "text-[#b91c1c]"}`}
            >
              {l.ok ? "✓" : "✕"} {l.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------- 3. Videos + transcripts ----------------------- */

function VideosPanel({
  projectId,
  onSaveScript,
}: {
  projectId: string;
  onSaveScript: (name: string, body: string) => void | Promise<void>;
}) {
  const [videos, setVideos] = useState<VtVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [composing, setComposing] = useState(false);
  // Transcripts live in the database, not in this component: a batch keeps
  // running after the tab closes, and reopening the tab shows the results.
  const [saved, setSaved] = useState<Record<string, SavedTranscript>>({});
  const [txErr, setTxErr] = useState<string | null>(null);
  const [pollTick, setPollTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/vt/videos?projectId=${encodeURIComponent(projectId)}&limit=60`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) {
          setVideos(j.videos as VtVideo[]);
          setError(null);
        } else setError(j.error ?? "Could not load videos");
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const ids = useMemo(() => (videos ?? []).map((v) => v.id), [videos]);

  // Pull saved transcripts for everything on screen, then keep polling while
  // anything is still queued or running.
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    fetch(`/api/vt/transcribe?ids=${ids.join(",")}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.ok) return;
        const map: Record<string, SavedTranscript> = {};
        for (const t of j.transcripts as SavedTranscript[]) map[t.videoId] = t;
        setSaved(map);
        if ((j.transcripts as SavedTranscript[]).some(
          (t) => t.status === "queued" || t.status === "running"
        )) {
          setTimeout(() => !cancelled && setPollTick((n) => n + 1), 6000);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ids, pollTick]);

  async function transcribeSelected() {
    const list = (videos ?? []).filter((v) => picked.includes(v.id));
    if (list.length === 0) return;
    setTxErr(null);
    try {
      const r = await fetch("/api/vt/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          videos: list.map((v) => ({
            videoId: v.id,
            url: v.url,
            platform: v.platform,
            creator: v.creator,
            caption: v.caption,
            views: v.views,
          })),
        }),
      }).then((x) => x.json());
      if (!r.ok) {
        setTxErr(r.error ?? "Could not start transcription");
        return;
      }
      const map: Record<string, SavedTranscript> = { ...saved };
      for (const t of r.transcripts as SavedTranscript[]) map[t.videoId] = t;
      setSaved(map);
      setPollTick((n) => n + 1);
    } catch (e) {
      setTxErr((e as Error).message);
    }
  }

  const shown = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = videos ?? [];
    if (terms.length === 0) return list;
    return list.filter((v) => {
      const hay = `${v.caption} ${v.creator}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [videos, query]);

  // Detail is fetched once per video and cached for the session — reopening a
  // card is instant, and the AI breakdown (which costs money) is never
  // re-requested behind your back.
  const loadDetail = useCallback(async (id: string) => {
    setDetails((d) =>
      d[id]
        ? d
        : {
            ...d,
            [id]: {
              transcript: null,
              transcriptStatus: "loading",
              analysis: null,
              analysisError: null,
              loading: true,
              analyzing: false,
            },
          }
    );
    try {
      const r = await fetch(`/api/vt/videos/${id}`, { cache: "no-store" }).then((x) => x.json());
      setDetails((d) => ({
        ...d,
        [id]: {
          ...d[id],
          loading: false,
          transcript: r.ok ? r.video.transcript : null,
          transcriptStatus: r.ok ? r.video.transcriptStatus : "failed",
        },
      }));
    } catch {
      setDetails((d) => ({
        ...d,
        [id]: { ...d[id], loading: false, transcriptStatus: "failed" },
      }));
    }
  }, []);

  async function analyze(id: string) {
    setDetails((d) => ({ ...d, [id]: { ...d[id], analyzing: true, analysisError: null } }));
    try {
      const r = await fetch("/api/vt/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId: id }),
      }).then((x) => x.json());
      setDetails((d) => ({
        ...d,
        [id]: {
          ...d[id],
          analyzing: false,
          analysis: r.ok ? (r.analysis as VtAnalysis) : null,
          analysisError: r.ok ? null : (r.error as string),
        },
      }));
    } catch (e) {
      setDetails((d) => ({
        ...d,
        [id]: { ...d[id], analyzing: false, analysisError: (e as Error).message },
      }));
    }
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  const pickedVideos = (videos ?? []).filter((v) => picked.includes(v.id));

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-3">
      <PanelTitle step={3} meta={videos ? `${shown.length} of ${videos.length}` : undefined}>
        What is working
      </PanelTitle>

      <div className="flex gap-1.5 flex-wrap items-center mb-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search captions and creators…"
          className="flex-1 min-w-[180px] border-2 border-line bg-background rounded-sm px-2 py-1.5 text-xs font-bold"
        />
        <button
          type="button"
          onClick={() => void transcribeSelected()}
          disabled={picked.length === 0}
          title="Pull the spoken words out of every selected video"
          className="border-2 border-line bg-ink text-background rounded-sm px-3 py-1.5 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-40"
        >
          ⤓ Transcribe {picked.length || ""}
        </button>
        <button
          type="button"
          onClick={() => setComposing(true)}
          disabled={picked.length === 0}
          className="border-2 border-line bg-accent text-accent-ink rounded-sm px-3 py-1.5 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-40"
        >
          ✎ Write from {picked.length || ""} selected
        </button>
      </div>

      {txErr && <p className="text-xs text-[#b91c1c] font-bold mb-1.5">{txErr}</p>}
      {(() => {
        const vals = Object.values(saved);
        const busy = vals.filter((t) => t.status === "queued" || t.status === "running").length;
        const done = vals.filter((t) => t.status === "done").length;
        const failed = vals.filter((t) => t.status === "failed").length;
        if (busy === 0 && done === 0 && failed === 0) return null;
        return (
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">
            {busy > 0 ? `Transcribing ${busy}… ` : ""}
            {done} transcribed
            {failed > 0 ? ` · ${failed} failed` : ""}
            {busy > 0 ? " · keeps running if you close this tab" : ""}
          </p>
        );
      })()}
      {error && <p className="text-xs text-[#b91c1c] font-bold">{error}</p>}
      {!videos ? (
        <p className="text-xs text-muted">Loading videos…</p>
      ) : videos.length === 0 ? (
        <p className="text-xs text-muted italic">
          Nothing tracked in this project yet — add an account or paste links above.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 max-h-[30rem] overflow-y-auto pr-0.5">
          {shown.map((v) => {
            const on = picked.includes(v.id);
            return (
              <div
                key={v.id}
                className={`relative border-2 rounded-md overflow-hidden ${on ? "border-accent" : "border-line"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpen(v.id);
                    void loadDetail(v.id);
                  }}
                  title="Open transcript and breakdown"
                  className="w-full text-left nb-press"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbSrc(v.thumbnail)}
                    alt=""
                    className="w-full aspect-square object-cover bg-paper"
                  />
                  <span className="block px-1.5 py-1">
                    <span className="block text-[10px] font-black">
                      {compact(v.views)} views
                    </span>
                    <span className="block text-[9px] font-bold text-muted truncate">
                      @{v.creator}
                      {saved[v.id]?.status === "done"
                        ? " · 📄"
                        : saved[v.id]?.status === "running"
                          ? " · ⋯"
                          : saved[v.id]?.status === "queued"
                            ? " · ·"
                            : saved[v.id]?.status === "failed"
                              ? " · ✕"
                              : ""}
                    </span>
                    <span className="block text-[9px] leading-tight line-clamp-2 mt-0.5">
                      {v.caption || "(no caption)"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggle(v.id)}
                  aria-pressed={on}
                  title={on ? "Remove from the script pool" : "Add to the script pool"}
                  className={`absolute top-1 right-1 w-5 h-5 border-2 border-line rounded-sm text-[11px] font-black leading-none flex items-center justify-center nb-press ${
                    on ? "bg-accent text-accent-ink" : "bg-background"
                  }`}
                >
                  {on ? "✓" : "+"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <VideoDetailModal
          video={(videos ?? []).find((v) => v.id === open)!}
          detail={details[open]}
          saved={saved[open]}
          onAnalyze={() => void analyze(open)}
          onTranscribe={() => {
            setPicked((p) => (p.includes(open) ? p : [...p, open]));
            void transcribeSelected();
          }}
          onClose={() => setOpen(null)}
        />
      )}

      {composing && (
        <ComposerModal
          videos={pickedVideos}
          details={details}
          saved={saved}
          onClose={() => setComposing(false)}
          onSave={onSaveScript}
        />
      )}
    </section>
  );
}

/* --------------------------- Video detail modal -------------------------- */

function Shell({
  title,
  subtitle,
  onClose,
  footer,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-ink/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[92vh] flex flex-col bg-background border-2 border-line rounded-md nb-shadow overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-3 bg-paper border-b-2 border-line">
          <div className="min-w-0">
            {subtitle && (
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                {subtitle}
              </div>
            )}
            <div className="font-black leading-tight line-clamp-2">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border-2 border-line bg-background px-2.5 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            ✕ Close
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-2 flex-wrap px-4 py-3 bg-paper border-t-2 border-line">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoDetailModal({
  video,
  detail,
  saved,
  onAnalyze,
  onTranscribe,
  onClose,
}: {
  video: VtVideo;
  detail?: Detail;
  saved?: SavedTranscript;
  onAnalyze: () => void;
  onTranscribe: () => void;
  onClose: () => void;
}) {
  const a = detail?.analysis;
  // Our own transcript wins: it is the verbatim one, pulled from the video
  // itself. ViewTrack's only exists for YouTube.
  const transcript =
    saved?.transcript?.trim() || detail?.transcript?.trim() || a?.transcript?.trim() || "";
  const status = detail?.transcriptStatus ?? "none";

  return (
    <Shell
      subtitle={`@${video.creator} · ${compact(video.views)} views · ${video.platform}`}
      title={video.caption || "(no caption)"}
      onClose={onClose}
      footer={
        <>
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="border-2 border-line bg-background px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            Open post ↗
          </a>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={detail?.analyzing}
            className="border-2 border-line bg-background px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {detail?.analyzing ? "Analyzing…" : a ? "Re-run breakdown" : "AI breakdown"}
          </button>
          <button
            type="button"
            onClick={onTranscribe}
            disabled={saved?.status === "queued" || saved?.status === "running"}
            className="border-2 border-line bg-accent text-accent-ink px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {saved?.status === "running"
              ? "Transcribing…"
              : saved?.status === "queued"
                ? "Queued…"
                : saved?.status === "done"
                  ? "Re-transcribe"
                  : "⤓ Transcribe"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbSrc(video.thumbnail)}
            alt=""
            className="w-24 h-24 object-cover border-2 border-line rounded-sm bg-paper shrink-0"
          />
          <dl className="grid grid-cols-3 gap-2 text-center flex-1">
            {[
              ["Views", compact(video.views)],
              ["Likes", compact(video.likes)],
              ["Comments", compact(video.comments)],
            ].map(([k, v]) => (
              <div key={k} className="border-2 border-line rounded-sm py-1.5 bg-paper">
                <dd className="font-black text-sm">{v}</dd>
                <dt className="text-[9px] uppercase tracking-widest font-bold text-muted">
                  {k}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1.5">
            Transcript
          </div>
          {transcript ? (
            <p className="text-sm whitespace-pre-line leading-relaxed">{transcript}</p>
          ) : saved?.status === "running" || saved?.status === "queued" ? (
            <p className="text-sm text-muted">
              {saved.status === "running" ? "Transcribing now" : "Queued"} — this keeps
              running on the server, so you can close this and come back.
            </p>
          ) : saved?.status === "failed" ? (
            <p className="text-sm text-[#b91c1c] font-bold">{saved.error}</p>
          ) : detail?.loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <p className="text-sm text-muted">
              {status === "unavailable"
                ? "ViewTrack has no captions for this platform. Hit Transcribe and the words get pulled from the video itself."
                : "No transcript yet — hit Transcribe."}
            </p>
          )}
        </div>

        {detail?.analysisError && (
          <p className="text-xs text-[#b91c1c] font-bold">{detail.analysisError}</p>
        )}

        {a && (
          <div className="space-y-3 border-t-2 border-line pt-3">
            {a.hook && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
                  Hook
                </div>
                <p className="text-sm">{a.hook}</p>
              </div>
            )}
            {a.summary && <p className="text-sm text-muted">{a.summary}</p>}
            {(a.tone || a.pacing) && (
              <p className="text-xs font-bold">
                {[a.tone, a.pacing].filter(Boolean).join(" · ")}
              </p>
            )}
            {a.whatWorked && a.whatWorked.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
                  What worked
                </div>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {a.whatWorked.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ------------------------------- Composer -------------------------------- */

function ComposerModal({
  videos,
  details,
  saved,
  onClose,
  onSave,
}: {
  videos: VtVideo[];
  details: Record<string, Detail>;
  saved: Record<string, SavedTranscript>;
  onClose: () => void;
  onSave: (name: string, body: string) => void | Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Whatever has already been fetched for these videos rides along. Nothing is
  // fetched here: the composer must never quietly spend money on breakdowns.
  const research = videos.map((v) => {
    const d = details[v.id];
    return {
      creator: v.creator,
      platform: v.platform,
      views: v.views,
      url: v.url,
      caption: v.caption,
      hook: d?.analysis?.hook,
      transcript:
        saved[v.id]?.transcript ?? d?.transcript ?? d?.analysis?.transcript ?? undefined,
      whatWorked: d?.analysis?.whatWorked,
    };
  });
  const withTranscript = research.filter((r) => r.transcript?.trim()).length;

  async function run() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setOut("");
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          userPrompt:
            prompt.trim() ||
            "Write a new short-form script in the same vein as these reference videos.",
          research,
        }),
      });
      if (!res.ok || !res.body) {
        setErr(await res.text());
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setOut((s) => s + dec.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => abort.current?.abort(), []);

  return (
    <Shell
      wide
      subtitle={`${videos.length} reference video${videos.length === 1 ? "" : "s"} · ${withTranscript} with a transcript`}
      title="Write a script from what is working"
      onClose={onClose}
      footer={
        <>
          {out.trim() && (
            <button
              type="button"
              onClick={() => {
                void onSave(name.trim() || "Script from research", out.trim());
                onClose();
              }}
              className="border-2 border-line bg-accent text-accent-ink px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
            >
              + Save as a script
            </button>
          )}
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="border-2 border-line bg-ink text-background px-3 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {busy ? "Writing…" : out ? "Rewrite" : "Write it"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {videos.map((v) => (
            <span
              key={v.id}
              className="border-2 border-line rounded-sm px-1.5 py-0.5 text-[10px] font-bold bg-paper"
            >
              @{v.creator} · {compact(v.views)}
              {saved[v.id]?.transcript || details[v.id]?.transcript ? " · 📄" : ""}
            </span>
          ))}
        </div>

        {withTranscript === 0 && (
          <p className="text-[11px] font-bold text-muted">
            None of these have a transcript yet, so the model only gets captions and view
            counts. Close this, hit Transcribe on them, and the script gets written off
            what they actually say.
          </p>
        )}

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
            Name it
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Script from research"
            className="w-full border-2 border-line bg-background rounded-sm px-2 py-1.5 text-xs font-bold"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
            What should it say
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. 15s, Prayer Lock, same judgment-day angle as these but for the phone-addiction crowd"
            className="w-full border-2 border-line bg-background rounded-sm px-2 py-1.5 text-xs font-bold"
          />
        </div>

        {err && <p className="text-xs text-[#b91c1c] font-bold">{err}</p>}

        {(out || busy) && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-1">
              Draft
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed border-2 border-line rounded-sm bg-paper p-3 font-sans">
              {out || "…"}
            </pre>
          </div>
        )}
      </div>
    </Shell>
  );
}
