"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  STUDIO_DEFAULTS,
  buildCaption,
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

type Activity = {
  clips: StudioClip[];
  renders: StudioRender[];
  users: Record<string, { name: string | null; email: string }>;
};

function uploadClip(
  slug: string,
  file: File,
  kind: "broll" | "example",
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
  const [uploads, setUploads] = useState<{ key: string; name: string; kind: "broll" | "example"; progress: number; error?: string }[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const exampleInput = useRef<HTMLInputElement | null>(null);

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
  const anyPending = !!activity?.clips.some((c) => c.status === "processing" || c.status === "queued") ||
    !!activity?.renders.some((r) => r.status === "processing" || r.status === "queued");
  useEffect(() => {
    if (!anyPending) return;
    const id = setInterval(() => void loadActivity(), 3000);
    return () => clearInterval(id);
  }, [anyPending, loadActivity]);

  async function onFiles(files: FileList | null, kind: "broll" | "example") {
    if (!files) return;
    const list = Array.from(files);
    if (fileInput.current) fileInput.current.value = "";
    if (exampleInput.current) exampleInput.current.value = "";
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
  const demos = (activity?.clips ?? []).filter((c) => c.kind === "demo");
  const renders = activity?.renders ?? [];
  const byUser = new Map<string, { demos: StudioClip[]; renders: StudioRender[] }>();
  for (const d of demos) {
    const k = d.userId ?? "?";
    if (!byUser.has(k)) byUser.set(k, { demos: [], renders: [] });
    byUser.get(k)!.demos.push(d);
  }
  for (const r of renders) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, { demos: [], renders: [] });
    byUser.get(r.userId)!.renders.push(r);
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

      {/* Creator activity */}
      <div className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-black">
              Creator activity · {byUser.size} {byUser.size === 1 ? "creator" : "creators"} ·{" "}
              {demos.length} demos · {renders.length} videos
            </div>
            <p className="text-xs text-muted">Everything creators have uploaded and built.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadActivity()}
            className="border-2 border-line bg-background px-2 py-1 rounded-md nb-press text-[10px] font-black uppercase tracking-widest"
          >
            Refresh
          </button>
        </div>
        {byUser.size === 0 ? (
          <p className="text-sm text-muted border-2 border-dashed border-line bg-paper rounded-md p-4">
            Nothing yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {Array.from(byUser.entries()).map(([uid, v]) => {
              const u = activity?.users[uid];
              const who = uid === "_admin" ? "Admin (you)" : u?.name || u?.email || uid;
              return (
                <li key={uid} className="border-2 border-line rounded-md bg-background">
                  <details>
                    <summary className="flex items-center gap-3 p-3 cursor-pointer">
                      <span className="font-black text-sm flex-1 min-w-0 truncate">
                        {who}
                        {u?.email && u.name ? (
                          <span className="text-muted font-normal"> · {u.email}</span>
                        ) : null}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                        {v.demos.length} demos · {v.renders.length} videos
                      </span>
                    </summary>
                    <div className="border-t-2 border-line p-3 space-y-3">
                      {v.demos.length > 0 && (
                        <div>
                          <div className={label}>Demos</div>
                          <ul className="mt-1 flex gap-2 overflow-x-auto">
                            {v.demos.map((d) => (
                              <li key={d.id} className="shrink-0 w-16">
                                <a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="block border-2 border-line rounded-sm overflow-hidden aspect-[9/16] bg-paper">
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
                        </div>
                      )}
                      {v.renders.length > 0 && (
                        <div>
                          <div className={label}>Videos</div>
                          <ul className="mt-1 space-y-1.5">
                            {v.renders.map((r) => (
                              <li key={r.id} className="flex items-center gap-2 text-sm">
                                <span className="w-8 shrink-0 aspect-[9/16] border-2 border-line bg-paper rounded-sm overflow-hidden">
                                  {r.posterUrl && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={r.posterUrl} alt="" className="w-full h-full object-cover" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block font-bold truncate">{r.hookText}</span>
                                  <span className="block text-[10px] text-muted">
                                    {new Date(r.createdAt).toLocaleString()} · {r.status}
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
                                  onClick={() => void deleteRender(r.id)}
                                  className="text-xs font-black px-1 text-muted hover:text-[#b91c1c]"
                                  aria-label="Delete"
                                >
                                  ✕
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
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
