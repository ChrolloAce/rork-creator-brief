"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  STUDIO_DEFAULTS,
  buildCaption,
  newAssetId,
  newHookId,
  normalizeTag,
  type StudioClip,
  type StudioConfig,
  type StudioHook,
  type StudioRender,
} from "@/lib/studio";

// Admin side of the Video Builder: switch it on, write the hook + explanation
// pairs, set the caption and hashtags, upload the satisfying background clips,
// and watch what creators have built. Config saves through the curation blob
// (debounced by the parent); clips go straight to the studio API.

const label = "text-[10px] uppercase tracking-[0.2em] font-bold text-muted";
const input =
  "mt-1 w-full border-2 border-line rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:border-accent";

type Creator = {
  id: string;
  name: string | null;
  email: string | null;
  demos: StudioClip[];
  readyDemos: number;
  ready: boolean;
  renders: StudioRender[];
};

type Activity = {
  minDemos: number;
  schedule: { autoFill: boolean; perDay: number; daysAhead: number };
  creators: Creator[];
  // Shared clips (background + example); demos live on each creator.
  clips: StudioClip[];
};

function localYmd(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shortDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en", { weekday: "short", day: "numeric" });
}

function uploadClip(
  slug: string,
  file: File,
  kind: "broll" | "example" | "showcase",
  onProgress: (p: number) => void
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const q = new URLSearchParams({ filename: file.name, kind });
    xhr.open("POST", `/api/studio/${encodeURIComponent(slug)}/clips?${q}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let j: { error?: string } = {};
      try {
        j = JSON.parse(xhr.responseText);
      } catch {
        /* non-json */
      }
      resolve(xhr.status < 300 ? { ok: true } : { ok: false, error: j.error ?? `HTTP ${xhr.status}` });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Upload failed" });
    xhr.send(file);
  });
}

export function StudioAdmin({
  briefSlug,
  config,
  onChange,
}: {
  briefSlug: string;
  config: StudioConfig | undefined;
  onChange: (next: StudioConfig) => void;
}) {
  const cfg: StudioConfig = { hooks: [], ...(config ?? {}) };
  const hooks = Array.isArray(cfg.hooks) ? cfg.hooks : [];
  const set = (patch: Partial<StudioConfig>) => onChange({ ...cfg, hooks, ...patch });
  const setHooks = (next: StudioHook[]) => set({ hooks: next });

  const [activity, setActivity] = useState<Activity | null>(null);
  const [uploads, setUploads] = useState<{ key: string; name: string; kind: "broll" | "example" | "showcase"; progress: number; error?: string }[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const exampleInput = useRef<HTMLInputElement | null>(null);
  const showcaseInput = useRef<HTMLInputElement | null>(null);
  const assetInput = useRef<HTMLInputElement | null>(null);
  const [assetBusy, setAssetBusy] = useState<string | null>(null);
  const [assetErr, setAssetErr] = useState<string | null>(null);

  // Assets go through /api/uploads (multipart, admin-only), same as format
  // assets, and live in the config as {url, mime, filename, label}.
  async function onAssetFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    if (assetInput.current) assetInput.current.value = "";
    setAssetErr(null);
    let next = [...(cfg.assets ?? [])];
    for (const file of list) {
      setAssetBusy(file.name);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.url) throw new Error(j.error ?? `upload failed: HTTP ${res.status}`);
        next = [
          ...next,
          { id: newAssetId(), url: j.url as string, mime: (j.mime as string) ?? file.type, filename: (j.filename as string) ?? file.name, label: "" },
        ];
        set({ assets: next });
      } catch (e) {
        setAssetErr(`${file.name}: ${(e as Error).message}`);
      }
    }
    setAssetBusy(null);
  }

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/briefs/${encodeURIComponent(briefSlug)}/studio`, { cache: "no-store" });
      const j = await res.json();
      if (j.ok) setActivity(j as Activity);
    } catch {
      /* transient */
    }
  }, [briefSlug]);
  useEffect(() => {
    // Kick off in a microtask: the fetch resolves later anyway, and this keeps
    // the effect body free of anything that looks like a synchronous setState.
    void Promise.resolve().then(loadActivity);
  }, [loadActivity]);
  const anyPending =
    !!activity?.clips.some((c) => c.status === "processing" || c.status === "queued") ||
    !!activity?.creators.some((u) =>
      u.demos.some((c) => c.status === "processing" || c.status === "queued") ||
      u.renders.some((r) => r.status === "processing" || r.status === "queued")
    );
  useEffect(() => {
    if (!anyPending) return;
    const id = setInterval(() => void loadActivity(), 3000);
    return () => clearInterval(id);
  }, [anyPending, loadActivity]);

  async function onFiles(files: FileList | null, kind: "broll" | "example" | "showcase") {
    if (!files) return;
    const list = Array.from(files);
    if (fileInput.current) fileInput.current.value = "";
    if (exampleInput.current) exampleInput.current.value = "";
    if (showcaseInput.current) showcaseInput.current.value = "";
    for (const file of list) {
      const key = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setUploads((u) => [...u, { key, name: file.name, kind, progress: 0 }]);
      const r = await uploadClip(briefSlug, file, kind, (p) =>
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x)))
      );
      if (r.ok) {
        setUploads((u) => u.filter((x) => x.key !== key));
        await loadActivity();
      } else {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: r.error } : x)));
      }
    }
  }

  async function deleteClip(id: string) {
    if (!confirm("Delete this clip?")) return;
    await fetch(`/api/studio/${encodeURIComponent(briefSlug)}/clips/${id}`, { method: "DELETE" });
    await loadActivity();
  }
  async function deleteRender(id: string) {
    if (!confirm("Delete this render?")) return;
    await fetch(`/api/studio/${encodeURIComponent(briefSlug)}/renders/${id}`, { method: "DELETE" });
    await loadActivity();
  }

  const broll = (activity?.clips ?? []).filter((c) => c.kind === "broll");
  const examples = (activity?.clips ?? []).filter((c) => c.kind === "example");
  const showcase = (activity?.clips ?? []).filter((c) => c.kind === "showcase");
  const assets = cfg.assets ?? [];
  const creators = activity?.creators ?? [];
  const readyCreators = creators.filter((c) => c.ready);
  const week = Array.from({ length: 7 }, (_, i) => localYmd(i));

  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  async function schedule(body: Record<string, unknown>) {
    setScheduling(true);
    setScheduleMsg(null);
    try {
      const res = await fetch(`/api/briefs/${encodeURIComponent(briefSlug)}/studio/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, today: localYmd() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) setScheduleMsg(`Failed: ${j.error ?? `HTTP ${res.status}`}`);
      else {
        const reasons = Object.values(j.results ?? {})
          .map((r) => (r as { reason?: string; error?: string }).reason ?? (r as { error?: string }).error)
          .filter(Boolean);
        setScheduleMsg(
          `Queued ${j.created} ${j.created === 1 ? "video" : "videos"}.` +
            (reasons.length ? ` Skipped: ${Array.from(new Set(reasons)).join("; ")}.` : "")
        );
      }
      await loadActivity();
    } catch (e) {
      setScheduleMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setScheduling(false);
    }
  }
  const sampleHook = hooks.find((h) => !h.hidden) ?? { hook: "Your hook", explanation: "Your explanation" };
  const previewCaption = buildCaption(cfg, sampleHook);

  return (
    <div className="space-y-4">
      {/* On/off + identity */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-black text-lg">Video Builder</div>
            <p className="text-xs text-muted mt-0.5 max-w-prose">
              Creators upload demos of themselves using the product and tap Generate. Each tap
              picks the hook, demo and background clip they have used least, stitches background +
              hook card + explanation card + demo, and hands back the caption. Only shows on this
              brief.
            </p>
          </div>
          <label className="flex items-center gap-2 border-2 border-line rounded-md px-3 py-2 cursor-pointer bg-paper">
            <input
              type="checkbox"
              checked={!!cfg.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
            />
            <span className="text-xs font-black uppercase tracking-widest">
              {cfg.enabled ? "Live for creators" : "Off"}
            </span>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] gap-3">
          <label className="block">
            <span className={label}>Title (sidebar)</span>
            <input
              type="text"
              value={cfg.title ?? ""}
              placeholder={STUDIO_DEFAULTS.title}
              onChange={(e) => set({ title: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Intro for creators</span>
            <textarea
              value={cfg.intro ?? ""}
              rows={2}
              placeholder="One or two lines explaining what to record and why."
              onChange={(e) => set({ intro: e.target.value })}
              className={input}
            />
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <a
            href={`/b/${briefSlug}/studio`}
            target="_blank"
            rel="noreferrer"
            className="border-2 border-line bg-background px-3 py-1.5 rounded-md nb-press font-black uppercase tracking-widest"
          >
            Open builder ↗
          </a>
          <span className="text-muted">
            As admin you can open it without a creator account to test a build.
          </span>
        </div>
      </div>

      {/* Hooks */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-black">Hooks · {hooks.length}</div>
            <p className="text-xs text-muted">
              Each pair is one video option; Generate rotates through them per creator. Hook goes
              up first (black card), explanation second (white card), then the demo cuts in. Keep
              hooks under ~12 words.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setHooks([...hooks, { id: newHookId(), hook: "", explanation: "" }])
            }
            className="border-2 border-line bg-ink text-background px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
          >
            + Add hook
          </button>
        </div>
        {hooks.length === 0 && (
          <p className="text-sm text-muted border-2 border-dashed border-line bg-paper rounded-md p-4">
            No hooks yet. Add the first pair.
          </p>
        )}
        <ul className="space-y-2">
          {hooks.map((h, i) => (
            <li
              key={h.id}
              className={`border-2 border-line rounded-md p-3 space-y-2 ${h.hidden ? "bg-paper opacity-70" : "bg-background"}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 border-2 border-line bg-paper rounded-sm flex items-center justify-center text-[10px] font-black">
                  {i + 1}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => {
                    const n = [...hooks];
                    [n[i - 1], n[i]] = [n[i], n[i - 1]];
                    setHooks(n);
                  }}
                  className="text-xs font-black px-1.5 disabled:opacity-30"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === hooks.length - 1}
                  onClick={() => {
                    const n = [...hooks];
                    [n[i + 1], n[i]] = [n[i], n[i + 1]];
                    setHooks(n);
                  }}
                  className="text-xs font-black px-1.5 disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!h.hidden}
                    onChange={(e) =>
                      setHooks(hooks.map((x) => (x.id === h.id ? { ...x, hidden: !e.target.checked } : x)))
                    }
                  />
                  Live
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm("Delete this hook?")) return;
                    setHooks(hooks.filter((x) => x.id !== h.id));
                  }}
                  className="text-xs font-black px-1.5 text-muted hover:text-[#b91c1c]"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="block">
                  <span className={label}>Hook</span>
                  <textarea
                    value={h.hook}
                    rows={2}
                    maxLength={240}
                    placeholder="This AI tool makes a whole video from one prompt"
                    onChange={(e) =>
                      setHooks(hooks.map((x) => (x.id === h.id ? { ...x, hook: e.target.value } : x)))
                    }
                    className={`${input} font-bold`}
                  />
                </label>
                <label className="block">
                  <span className={label}>Explanation</span>
                  <textarea
                    value={h.explanation}
                    rows={2}
                    maxLength={600}
                    placeholder="It writes the voice, music and sound effects in one place. Here is what it looks like."
                    onChange={(e) =>
                      setHooks(hooks.map((x) => (x.id === h.id ? { ...x, explanation: e.target.value } : x)))
                    }
                    className={input}
                  />
                </label>
              </div>
              <details>
                <summary className="text-[10px] font-bold uppercase tracking-widest text-muted cursor-pointer">
                  Caption override {h.caption?.trim() ? "· set" : "· uses template"}
                </summary>
                <textarea
                  value={h.caption ?? ""}
                  rows={3}
                  placeholder="Leave empty to use the caption template below. {hook} and {explanation} work here too."
                  onChange={(e) =>
                    setHooks(hooks.map((x) => (x.id === h.id ? { ...x, caption: e.target.value } : x)))
                  }
                  className={input}
                />
              </details>
            </li>
          ))}
        </ul>
      </div>

      {/* Caption */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="font-black">Caption</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-3">
            <label className="block">
              <span className={label}>Caption template</span>
              <textarea
                value={cfg.captionTemplate ?? ""}
                rows={4}
                placeholder={"{explanation}\n\nMade with ElevenCreative."}
                onChange={(e) => set({ captionTemplate: e.target.value })}
                className={input}
              />
              <span className="block text-[11px] text-muted mt-1">
                {"{hook}"} and {"{explanation}"} are replaced with the pair the creator picked.
                Hashtags are added underneath automatically.
              </span>
            </label>
            <TagInput
              heading="Required hashtags (always first)"
              value={cfg.requiredHashtags ?? []}
              onChange={(v) => set({ requiredHashtags: v })}
              placeholder="ElevenLabsPartner"
            />
            <TagInput
              heading="Hashtags"
              value={cfg.hashtags ?? []}
              onChange={(v) => set({ hashtags: v })}
              placeholder="AI, AItools, contentcreator"
            />
          </div>
          <div>
            <span className={label}>Preview (first live hook)</span>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed border-2 border-line bg-paper rounded-md p-3 min-h-[120px]">
              {previewCaption}
            </pre>
          </div>
        </div>
      </div>

      {/* Timing + look */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="font-black">Timing and look</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="block md:col-span-2">
            <span className={label}>Opening</span>
            <select
              value={cfg.opening ?? STUDIO_DEFAULTS.opening}
              onChange={(e) => set({ opening: e.target.value as StudioConfig["opening"] })}
              className={input}
            >
              <option value="broll">Background clips + text cards</option>
              <option value="library">Hook library: first seconds of a real reel, then the demo</option>
            </select>
            <span className="block text-[10px] text-muted mt-0.5">
              Hook library uses every reel on this brief&apos;s Hooks tab (scripts/scrape-hooks.py), rotated per creator. Hooks, cards and background clips below are ignored in that mode.
            </span>
          </label>
          <label className="block">
            <span className={label}>After the hook</span>
            <select
              value={cfg.transition ?? "cut"}
              onChange={(e) => set({ transition: e.target.value as StudioConfig["transition"] })}
              className={input}
            >
              <option value="cut">Hard cut to the demo</option>
              <option value="pip">Shrink into a corner, keep playing</option>
            </select>
          </label>
          {(cfg.transition ?? "cut") === "pip" && (
            <>
              <label className="block">
                <span className={label}>Corner</span>
                <select
                  value={cfg.pipCorner ?? "bottom-left"}
                  onChange={(e) => set({ pipCorner: e.target.value as StudioConfig["pipCorner"] })}
                  className={input}
                >
                  <option value="bottom-left">Bottom left</option>
                  <option value="top-left">Top left</option>
                  <option value="bottom-right">Bottom right</option>
                  <option value="top-right">Top right</option>
                </select>
              </label>
              <label className="block">
                <span className={label}>Corner size</span>
                <select
                  value={String(cfg.pipScale ?? 0.32)}
                  onChange={(e) => set({ pipScale: Number(e.target.value) })}
                  className={input}
                >
                  <option value="0.25">Small (25%)</option>
                  <option value="0.32">Medium (32%)</option>
                  <option value="0.4">Large (40%)</option>
                </select>
              </label>
            </>
          )}
          <label className="block">
            <span className={label}>Library hook (sec)</span>
            <input
              type="number"
              min={3}
              max={30}
              step={1}
              value={cfg.libraryHookSec ?? STUDIO_DEFAULTS.libraryHookSec}
              onChange={(e) => set({ libraryHookSec: Number(e.target.value) })}
              className={input}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <label className="block">
            <span className={label}>Hook card (sec)</span>
            <input
              type="number"
              min={1.5}
              max={8}
              step={0.5}
              value={cfg.hookSec ?? STUDIO_DEFAULTS.hookSec}
              onChange={(e) => set({ hookSec: Number(e.target.value) })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Explanation (sec)</span>
            <input
              type="number"
              min={0}
              max={12}
              step={0.5}
              value={cfg.explanationSec ?? STUDIO_DEFAULTS.explanationSec}
              onChange={(e) => set({ explanationSec: Number(e.target.value) })}
              className={input}
            />
            <span className="block text-[10px] text-muted mt-0.5">0 = auto from word count</span>
          </label>
          <label className="block">
            <span className={label}>Text style</span>
            <select
              value={cfg.textStyle ?? STUDIO_DEFAULTS.textStyle}
              onChange={(e) => set({ textStyle: e.target.value as StudioConfig["textStyle"] })}
              className={input}
            >
              <option value="pill">Pills (TikTok style)</option>
              <option value="shadow">White with shadow</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Ask for (min demos)</span>
            <input
              type="number"
              min={1}
              max={STUDIO_DEFAULTS.demoCap}
              value={cfg.minDemos ?? STUDIO_DEFAULTS.minDemos}
              onChange={(e) => set({ minDemos: Number(e.target.value) })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Ask for (max demos)</span>
            <input
              type="number"
              min={1}
              max={STUDIO_DEFAULTS.demoCap}
              value={cfg.maxDemos ?? STUDIO_DEFAULTS.maxDemos}
              onChange={(e) => set({ maxDemos: Number(e.target.value) })}
              className={input}
            />
          </label>
        </div>
      </div>

      {/* Step 1 for creators: how to record + example demos */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div>
          <div className="font-black">Step 1 for creators: recording their demos</div>
          <p className="text-xs text-muted">
            Creators see this before they can generate anything. Tell them how to record, show
            them a good example, and the reels from the hook library appear underneath
            automatically.
          </p>
        </div>
        <label className="block">
          <span className={label}>How to record (one line per bullet)</span>
          <textarea
            value={cfg.recordGuide ?? ""}
            rows={5}
            placeholder={"Screen-record yourself using the product from the first click to the result.\nVertical if you can. 20 to 60 seconds.\nShow the result at the end."}
            onChange={(e) => set({ recordGuide: e.target.value })}
            className={input}
          />
        </label>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-sm">Example demos · {examples.length}</div>
            <p className="text-xs text-muted">
              Real demos that got it right. Creators can play them inline.
            </p>
          </div>
          <div>
            <input
              ref={exampleInput}
              type="file"
              accept="video/*,.mov,.mp4,.m4v,.webm"
              multiple
              className="sr-only"
              onChange={(e) => void onFiles(e.target.files, "example")}
            />
            <button
              type="button"
              onClick={() => exampleInput.current?.click()}
              className="border-2 border-line bg-ink text-background px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
            >
              + Upload examples
            </button>
          </div>
        </div>
        {uploads.some((u) => u.kind === "example") && (
          <ul className="space-y-1">
            {uploads.filter((u) => u.kind === "example").map((u) => (
              <li key={u.key} className="text-xs flex items-center gap-2">
                <span className="font-bold truncate">{u.name}</span>
                {u.error ? (
                  <span className="text-[#b91c1c] font-bold">{u.error}</span>
                ) : (
                  <span className="text-muted">{Math.round(u.progress * 100)}%</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {examples.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
            {examples.map((b) => (
              <li key={b.id} className="border-2 border-line rounded-md overflow-hidden bg-background">
                <div className="relative aspect-[9/16] bg-paper">
                  {b.posterUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={b.posterUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted">
                      {b.status === "error" ? "failed" : "processing…"}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteClip(b.id)}
                    className="absolute top-1 right-1 w-6 h-6 border-2 border-line bg-background rounded-sm text-xs font-black"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                  {b.durationSec != null && (
                    <span className="absolute bottom-1 right-1 border-2 border-line bg-background px-1 text-[9px] font-black rounded-sm">
                      {Math.round(b.durationSec)}s
                    </span>
                  )}
                </div>
                <div className="px-1.5 py-1 text-[10px] font-bold truncate">
                  {b.label || b.filename || "example"}
                </div>
                {b.status === "error" && (
                  <div className="px-1.5 pb-1 text-[10px] text-[#b91c1c]">{b.error}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* How to create: guide + finished example + assets */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-4">
        <div>
          <div className="font-black">How to create (assets + finished example)</div>
          <p className="text-xs text-muted">
            For creators who build or edit the video themselves. Shows under the demos in step 1
            and as a collapsed section on the calendar. Hidden when everything here is empty.
          </p>
        </div>
        <label className="block">
          <span className={label}>How to create (one line per bullet)</span>
          <textarea
            value={cfg.createGuide ?? ""}
            rows={4}
            placeholder={"Open the assets below in your editor.\nPut the logo in the last 2 seconds.\nExport vertical 1080x1920."}
            onChange={(e) => set({ createGuide: e.target.value })}
            className={input}
          />
        </label>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-sm">Finished example · {showcase.length}</div>
            <p className="text-xs text-muted">A done video creators can play. Normalized like a demo.</p>
          </div>
          <div>
            <input
              ref={showcaseInput}
              type="file"
              accept="video/*,.mov,.mp4,.m4v,.webm"
              multiple
              className="sr-only"
              onChange={(e) => void onFiles(e.target.files, "showcase")}
            />
            <button
              type="button"
              onClick={() => showcaseInput.current?.click()}
              className="border-2 border-line bg-ink text-background px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
            >
              + Upload example
            </button>
          </div>
        </div>
        {uploads.some((u) => u.kind === "showcase") && (
          <ul className="space-y-1">
            {uploads.filter((u) => u.kind === "showcase").map((u) => (
              <li key={u.key} className="text-xs flex items-center gap-2">
                <span className="font-bold truncate">{u.name}</span>
                {u.error ? (
                  <span className="text-[#b91c1c] font-bold">{u.error}</span>
                ) : (
                  <span className="text-muted">{Math.round(u.progress * 100)}%</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {showcase.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
            {showcase.map((b) => (
              <li key={b.id} className="border-2 border-line rounded-md overflow-hidden bg-background">
                <div className="relative aspect-[9/16] bg-paper">
                  {b.posterUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={b.posterUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted">
                      {b.status === "error" ? "failed" : "processing…"}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteClip(b.id)}
                    className="absolute top-1 right-1 w-6 h-6 border-2 border-line bg-background rounded-sm text-xs font-black"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-1.5 py-1 text-[10px] font-bold truncate">{b.label || b.filename || "example"}</div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-sm">Assets · {assets.length}</div>
            <p className="text-xs text-muted">Images or videos they download: logos, overlays, b-roll, end cards.</p>
          </div>
          <div>
            <input
              ref={assetInput}
              type="file"
              accept="image/*,video/*,.mov,.mp4,.png,.jpg,.jpeg,.webp,.gif"
              multiple
              className="sr-only"
              onChange={(e) => void onAssetFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => assetInput.current?.click()}
              disabled={!!assetBusy}
              className="border-2 border-line bg-accent text-accent-ink px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              {assetBusy ? `Uploading ${assetBusy}…` : "+ Upload assets"}
            </button>
          </div>
        </div>
        {assetErr && <p className="text-xs font-bold text-[#b91c1c]">{assetErr}</p>}
        {assets.length > 0 && (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {assets.map((a) => (
              <li key={a.id} className="border-2 border-line rounded-md overflow-hidden bg-background">
                <div className="relative aspect-square bg-paper flex items-center justify-center">
                  {a.mime.startsWith("image/") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.url} alt="" className="w-full h-full object-contain" />
                  ) : a.mime.startsWith("video/") ? (
                    <video src={a.url} muted playsInline preload="metadata" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-muted">{a.mime}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm("Remove this asset?")) return;
                      set({ assets: assets.filter((x) => x.id !== a.id) });
                    }}
                    className="absolute top-1 right-1 w-6 h-6 border-2 border-line bg-background rounded-sm text-xs font-black"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-1.5 space-y-1">
                  <input
                    type="text"
                    value={a.label ?? ""}
                    placeholder={a.filename || "Label"}
                    onChange={(e) =>
                      set({ assets: assets.map((x) => (x.id === a.id ? { ...x, label: e.target.value } : x)) })
                    }
                    className="w-full border-2 border-line rounded-sm px-1.5 py-1 text-xs bg-background focus:outline-none focus:border-accent"
                  />
                  <div className="text-[10px] text-muted truncate">{a.filename}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Background clips */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-black">Background clips · {broll.length}</div>
            <p className="text-xs text-muted">
              The satisfying footage that plays under the hook and explanation. Vertical is best;
              anything else is cropped to fill. Trimmed to {STUDIO_DEFAULTS.maxBrollSec}s and
              looped if shorter than the text. Creators get one at random unless they pick.
            </p>
          </div>
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,.mov,.mp4,.m4v,.webm"
              multiple
              className="sr-only"
              onChange={(e) => void onFiles(e.target.files, "broll")}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="border-2 border-line bg-accent text-accent-ink px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
            >
              + Upload clips
            </button>
          </div>
        </div>
        {uploads.some((u) => u.kind === "broll") && (
          <ul className="space-y-1">
            {uploads.filter((u) => u.kind === "broll").map((u) => (
              <li key={u.key} className="text-xs flex items-center gap-2">
                <span className="font-bold truncate">{u.name}</span>
                {u.error ? (
                  <span className="text-[#b91c1c] font-bold">{u.error}</span>
                ) : (
                  <span className="text-muted">{Math.round(u.progress * 100)}%</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {broll.length === 0 && uploads.length === 0 ? (
          <p className="text-sm text-muted border-2 border-dashed border-line bg-paper rounded-md p-4">
            No background clips yet. Creators cannot build until there is at least one.
          </p>
        ) : (
          <ul className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
            {broll.map((b) => (
              <li key={b.id} className="border-2 border-line rounded-md overflow-hidden bg-background">
                <div className="relative aspect-[9/16] bg-paper">
                  {b.posterUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={b.posterUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted">
                      {b.status === "error" ? "failed" : "processing…"}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteClip(b.id)}
                    className="absolute top-1 right-1 w-6 h-6 border-2 border-line bg-background rounded-sm text-xs font-black"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                  {b.durationSec != null && (
                    <span className="absolute bottom-1 right-1 border-2 border-line bg-background px-1 text-[9px] font-black rounded-sm">
                      {Math.round(b.durationSec)}s
                    </span>
                  )}
                </div>
                <div className="px-1.5 py-1 text-[10px] font-bold truncate">
                  {b.label || b.filename || "clip"}
                </div>
                {b.status === "error" && (
                  <div className="px-1.5 pb-1 text-[10px] text-[#b91c1c]">{b.error}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Videos in advance */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-black">Videos in advance</div>
            <p className="text-xs text-muted max-w-prose">
              A creator with enough demos gets videos queued for the coming days, topped up
              whenever they open the builder, so they show up to a calendar that is already
              full. They can still generate extra ones for any day.
            </p>
          </div>
          <label className="flex items-center gap-2 border-2 border-line rounded-md px-3 py-2 cursor-pointer bg-paper">
            <input
              type="checkbox"
              checked={cfg.autoFill ?? STUDIO_DEFAULTS.autoFill}
              onChange={(e) => set({ autoFill: e.target.checked })}
            />
            <span className="text-xs font-black uppercase tracking-widest">Auto-fill</span>
          </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <label className="block">
            <span className={label}>Videos per day</span>
            <input
              type="number"
              min={0}
              max={5}
              value={cfg.perDay ?? STUDIO_DEFAULTS.perDay}
              onChange={(e) => set({ perDay: Number(e.target.value) })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Days ahead</span>
            <input
              type="number"
              min={1}
              max={14}
              value={cfg.daysAhead ?? STUDIO_DEFAULTS.daysAhead}
              onChange={(e) => set({ daysAhead: Number(e.target.value) })}
              className={input}
            />
          </label>
          <button
            type="button"
            disabled={scheduling}
            onClick={() => void schedule({ mode: "fill" })}
            className="md:col-span-2 border-2 border-line bg-ink text-background px-3 py-2 rounded-md nb-press text-xs font-black uppercase tracking-widest disabled:opacity-50"
          >
            {scheduling ? "Working…" : "Fill every ready creator now"}
          </button>
        </div>
        {scheduleMsg && <p className="text-xs font-bold">{scheduleMsg}</p>}
      </div>

      {/* Creators dashboard */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-black">
              Creators · {readyCreators.length} ready · {creators.length - readyCreators.length} not ready
            </div>
            <p className="text-xs text-muted">
              Ready = at least {activity?.minDemos ?? cfg.minDemos ?? STUDIO_DEFAULTS.minDemos} demos
              processed. Numbers under each day are that creator&apos;s videos for it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadActivity()}
            className="border-2 border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
          >
            Refresh
          </button>
        </div>
        {creators.length === 0 ? (
          <p className="text-sm text-muted border-2 border-dashed border-line bg-paper rounded-md p-4">
            No creators yet. They appear here after their first upload.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm border-separate border-spacing-0 min-w-[720px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted">
                  <th className="text-left font-bold pb-2 pr-3">Creator</th>
                  <th className="text-left font-bold pb-2 pr-3">Demos</th>
                  <th className="text-left font-bold pb-2 pr-3">Status</th>
                  {week.map((d) => (
                    <th key={d} className="text-center font-bold pb-2 px-1 whitespace-nowrap">
                      {d === week[0] ? "Today" : shortDay(d)}
                    </th>
                  ))}
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => (
                  <CreatorRow
                    key={c.id}
                    creator={c}
                    minDemos={activity?.minDemos ?? 3}
                    week={week}
                    scheduling={scheduling}
                    onAdd={(days, count) => void schedule({ mode: "add", userIds: [c.id], days, count })}
                    onDeleteRender={(id) => void deleteRender(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CreatorRow({
  creator: c,
  minDemos,
  week,
  scheduling,
  onAdd,
  onDeleteRender,
}: {
  creator: Creator;
  minDemos: number;
  week: string[];
  scheduling: boolean;
  onAdd: (days: string[], count: number) => void;
  onDeleteRender: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [addDay, setAddDay] = useState(week[1] ?? week[0]);
  const [addCount, setAddCount] = useState(1);
  const who = c.id === "_admin" ? "Admin (you)" : c.name || c.email || c.id;
  const forDay = (d: string) => c.renders.filter((r) => r.scheduledFor === d && r.status !== "error");
  const byDay = new Map<string, StudioRender[]>();
  for (const r of c.renders) {
    if (!byDay.has(r.scheduledFor)) byDay.set(r.scheduledFor, []);
    byDay.get(r.scheduledFor)!.push(r);
  }
  const dayKeys = Array.from(byDay.keys()).sort().reverse();
  return (
    <>
      <tr className="align-middle">
        <td className="py-2 pr-3 border-t-2 border-line">
          <button type="button" onClick={() => setOpen((x) => !x)} className="text-left">
            <span className="block font-black leading-tight">{who}</span>
            {c.email && c.name && <span className="block text-[11px] text-muted">{c.email}</span>}
          </button>
        </td>
        <td className="py-2 pr-3 border-t-2 border-line whitespace-nowrap">
          <span className="font-bold">{c.readyDemos}</span>
          <span className="text-muted"> / {minDemos}</span>
        </td>
        <td className="py-2 pr-3 border-t-2 border-line">
          {c.ready ? (
            <span className="inline-block border-2 border-line bg-success text-success-ink px-1.5 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest">
              Ready
            </span>
          ) : (
            <span className="inline-block border-2 border-line bg-paper px-1.5 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
              Needs {Math.max(0, minDemos - c.readyDemos)} more
            </span>
          )}
        </td>
        {week.map((d) => {
          const list = forDay(d);
          const busy = list.some((r) => r.status !== "ready");
          return (
            <td key={d} className="py-2 px-1 border-t-2 border-line text-center">
              <span
                className={`inline-flex items-center justify-center min-w-7 h-7 border-2 border-line rounded-sm text-xs font-black ${
                  list.length === 0 ? "bg-paper text-muted" : busy ? "bg-accent text-accent-ink" : "bg-ink text-background"
                }`}
                title={busy ? "Some still rendering" : undefined}
              >
                {list.length}
              </span>
            </td>
          );
        })}
        <td className="py-2 pl-2 border-t-2 border-line whitespace-nowrap">
          <button
            type="button"
            onClick={() => setOpen((x) => !x)}
            className="border-2 border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
          >
            {open ? "Close" : "Open"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4 + week.length} className="pb-3">
            <div className="border-2 border-line bg-paper rounded-md p-3 space-y-3">
              <div className="flex items-end gap-2 flex-wrap">
                <label className="block">
                  <span className={label}>Add videos on</span>
                  <input
                    type="date"
                    value={addDay}
                    min={week[0]}
                    onChange={(e) => setAddDay(e.target.value)}
                    className={input}
                  />
                </label>
                <label className="block">
                  <span className={label}>How many</span>
                  <select
                    value={addCount}
                    onChange={(e) => setAddCount(Number(e.target.value))}
                    className={input}
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={scheduling || !c.ready || !/^\d{4}-\d{2}-\d{2}$/.test(addDay)}
                  onClick={() => onAdd([addDay], addCount)}
                  className="border-2 border-line bg-ink text-background px-3 py-2 rounded-md nb-press text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  disabled={scheduling || !c.ready}
                  onClick={() => onAdd(week, 1)}
                  className="border-2 border-line bg-background px-3 py-2 rounded-md nb-press text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                  +1 every day this week
                </button>
                {!c.ready && (
                  <span className="text-[11px] text-muted">Needs {minDemos} processed demos first.</span>
                )}
              </div>

              <div>
                <div className={label}>Demos · {c.demos.length}</div>
                {c.demos.length === 0 ? (
                  <p className="text-xs text-muted mt-1">None uploaded yet.</p>
                ) : (
                  <ul className="mt-1 flex gap-2 overflow-x-auto">
                    {c.demos.map((d) => (
                      <li key={d.id} className="shrink-0 w-16">
                        <a
                          href={d.url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="block border-2 border-line rounded-sm overflow-hidden aspect-[9/16] bg-background"
                        >
                          {d.posterUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={d.posterUrl} alt="" className="w-full h-full object-cover" />
                          )}
                        </a>
                        <div className="text-[9px] text-muted truncate mt-0.5">
                          {d.status === "ready" ? `${Math.round(d.durationSec ?? 0)}s` : d.status}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className={label}>Videos · {c.renders.length}</div>
                {dayKeys.length === 0 ? (
                  <p className="text-xs text-muted mt-1">Nothing scheduled yet.</p>
                ) : (
                  <div className="mt-1 space-y-2">
                    {dayKeys.map((d) => (
                      <div key={d}>
                        <div className="text-[10px] font-black uppercase tracking-widest">
                          {d === week[0] ? "Today" : shortDay(d)} · {d}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {byDay.get(d)!.map((r) => (
                            <li key={r.id} className="flex items-center gap-2 text-sm bg-background border-2 border-line rounded-md px-2 py-1">
                              <span className="w-7 shrink-0 aspect-[9/16] border-2 border-line bg-paper rounded-sm overflow-hidden">
                                {r.posterUrl && (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={r.posterUrl} alt="" className="w-full h-full object-cover" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-bold truncate">{r.hookText}</span>
                                <span className="block text-[10px] text-muted">
                                  {r.status} · {r.source}
                                  {r.error ? ` · ${r.error}` : ""}
                                </span>
                              </span>
                              {r.url && (
                                <a
                                  href={`${r.url}?download=1`}
                                  className="border-2 border-line bg-background px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest nb-press"
                                >
                                  ⬇
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onDeleteRender(r.id)}
                                className="text-xs font-black px-1 text-muted hover:text-[#b91c1c]"
                                aria-label="Delete"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Comma/space separated tag entry that stores clean tags (no "#").
function TagInput({
  heading,
  value,
  onChange,
  placeholder,
}: {
  heading: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value.map((v) => `#${v}`).join(" "));
  // Keep the box in sync if the config changes underneath (e.g. reload),
  // without clobbering what is being typed: only react when the tags the
  // parent holds differ from the tags this box last produced.
  const joined = value.join("|");
  const [seen, setSeen] = useState(joined);
  if (joined !== seen) {
    setSeen(joined);
    setText(value.map((v) => `#${v}`).join(" "));
  }
  return (
    <label className="block">
      <span className={label}>{heading}</span>
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const tags = e.target.value
            .split(/[\s,]+/)
            .map(normalizeTag)
            .filter(Boolean);
          setSeen(tags.join("|"));
          onChange(tags);
        }}
        className={input}
      />
    </label>
  );
}
