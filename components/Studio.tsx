"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { StudioClip, StudioPublicConfig, StudioRender } from "@/lib/studio";

// The Video Builder, creator side. Three things on one page, top to bottom:
// the demos they have uploaded, the build panel (hook + demo + background),
// and the library of finished videos with their captions. Everything is
// sized for a phone because that is where creators live.

type State = {
  viewer: { id: string; name: string | null; email: string | null; isAdmin: boolean };
  config: StudioPublicConfig;
  demos: StudioClip[];
  broll: StudioClip[];
  renders: StudioRender[];
};

type Upload = { key: string; name: string; progress: number; error?: string };

const label = "text-[10px] uppercase tracking-[0.2em] font-bold text-muted";

function fmtSec(s: number | null): string {
  if (s == null) return "";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

function StatusPill({ status, lang }: { status: StudioClip["status"]; lang: Lang }) {
  const tone =
    status === "ready"
      ? "bg-success text-success-ink"
      : status === "error"
        ? "bg-[#fee2e2] text-[#b91c1c]"
        : "bg-paper text-ink";
  const text =
    status === "ready"
      ? t(lang, "ready")
      : status === "error"
        ? t(lang, "failed")
        : status === "queued"
          ? t(lang, "queued")
          : t(lang, "processing");
  return (
    <span
      className={`inline-flex items-center gap-1 border-2 border-line px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-sm ${tone}`}
    >
      {(status === "processing" || status === "queued") && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden />
      )}
      {text}
    </span>
  );
}

function CopyButton({
  value,
  text,
  lang,
  tone = "accent",
}: {
  value: string;
  text: string;
  lang: Lang;
  tone?: "accent" | "plain";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard blocked; the text is on screen to select by hand */
        }
      }}
      className={`shrink-0 border-2 border-line px-2.5 py-1.5 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest ${
        tone === "accent" ? "bg-accent text-accent-ink" : "bg-background"
      }`}
    >
      {copied ? t(lang, "copied") : text}
    </button>
  );
}

/* ------------------------------- sign in -------------------------------- */

function StudioSignIn({ lang, title }: { lang: Lang; title: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "login" ? { email, password } : { name, email, password };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        router.refresh();
        return;
      }
      setError(j.error ?? t(lang, "errGeneric"));
    } catch {
      setError(t(lang, "errGeneric"));
    }
    setLoading(false);
  }

  const input =
    "mt-1 w-full border-2 border-line rounded-md px-3 py-2 bg-background focus:outline-none focus:border-accent";
  return (
    <div className="space-y-6">
      <header>
        <div className={label}>{title}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
          {t(lang, "studioSignInTitle")}
        </h1>
        <p className="text-muted mt-2 max-w-prose">{t(lang, "studioSignInBody")}</p>
      </header>
      <form
        onSubmit={onSubmit}
        className="max-w-sm border-2 border-line rounded-md nb-shadow bg-background p-5 space-y-3"
      >
        {mode === "signup" && (
          <label className="block">
            <span className={label}>{t(lang, "yourName")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "namePlaceholder")}
              className={input}
            />
          </label>
        )}
        <label className="block">
          <span className={label}>{t(lang, "email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t(lang, "emailPlaceholder")}
            autoComplete="email"
            className={input}
          />
        </label>
        <label className="block">
          <span className={label}>{t(lang, "password")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "signup"
                ? t(lang, "passwordNewPlaceholder")
                : t(lang, "passwordPlaceholder")
            }
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={input}
          />
        </label>
        {error && (
          <p className="text-sm font-bold text-[#b91c1c] border-2 border-line bg-[#fee2e2] px-2 py-1.5 rounded-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full border-2 border-line bg-ink text-background font-black uppercase tracking-widest py-2.5 rounded-md nb-press disabled:opacity-50"
        >
          {loading ? "…" : mode === "login" ? t(lang, "logIn") : t(lang, "createAccount")}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          className="w-full text-sm font-bold text-muted hover:text-ink"
        >
          {mode === "login" ? t(lang, "needAccount") : t(lang, "haveAccount")}
        </button>
      </form>
    </div>
  );
}

/* -------------------------------- upload -------------------------------- */

function uploadFile(
  slug: string,
  file: File,
  onProgress: (p: number) => void
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const q = new URLSearchParams({ filename: file.name });
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
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true });
      else resolve({ ok: false, error: j.error });
    };
    xhr.onerror = () => resolve({ ok: false });
    xhr.send(file);
  });
}

/* -------------------------------- studio -------------------------------- */

export function Studio({
  briefSlug,
  title,
  signedIn,
  lang = "en",
}: {
  briefSlug: string;
  title: string;
  signedIn: boolean;
  lang?: Lang;
}) {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [justBuilt, setJustBuilt] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio/${encodeURIComponent(briefSlug)}/state`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setLoadError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setLoadError(null);
      setState(j as State);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [briefSlug]);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  // Poll while anything is still cooking. Cheap, and the same request wakes
  // the server queue after a restart.
  const pending = useMemo(
    () =>
      !!state &&
      (state.demos.some((d) => d.status === "processing" || d.status === "queued") ||
        state.renders.some((r) => r.status === "processing" || r.status === "queued")),
    [state]
  );
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [pending, load]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    if (fileInput.current) fileInput.current.value = "";
    for (const file of list) {
      const key = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
      if (file.size > (state?.config.maxUploadBytes ?? Infinity)) {
        setUploads((u) =>
          u.map((x) => (x.key === key ? { ...x, error: t(lang, "errTooLarge") } : x))
        );
        continue;
      }
      const r = await uploadFile(briefSlug, file, (p) =>
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x)))
      );
      if (r.ok) {
        setUploads((u) => u.filter((x) => x.key !== key));
        await load();
      } else {
        setUploads((u) =>
          u.map((x) =>
            x.key === key ? { ...x, error: r.error ?? t(lang, "errUploadFailed") } : x
          )
        );
      }
    }
  }

  async function deleteClip(id: string) {
    if (!confirm(t(lang, "confirmDelete"))) return;
    await fetch(`/api/studio/${encodeURIComponent(briefSlug)}/clips/${id}`, { method: "DELETE" });
    await load();
  }

  async function deleteRender(id: string) {
    if (!confirm(t(lang, "confirmDelete"))) return;
    await fetch(`/api/studio/${encodeURIComponent(briefSlug)}/renders/${id}`, { method: "DELETE" });
    await load();
  }

  // One tap. The server picks the hook, the demo and the background this
  // creator has used least, so repeated taps walk through the variety.
  async function generate() {
    if (!state) return;
    setBuilding(true);
    setBuildError(null);
    try {
      const res = await fetch(`/api/studio/${encodeURIComponent(briefSlug)}/renders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setBuildError(j.error ?? `HTTP ${res.status}`);
      } else {
        setJustBuilt((j.render as StudioRender).id);
        await load();
        setTimeout(
          () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          50
        );
      }
    } catch (e) {
      setBuildError((e as Error).message);
    } finally {
      setBuilding(false);
    }
  }

  if (!signedIn) return <StudioSignIn lang={lang} title={title} />;

  if (loadError && !state) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="text-sm font-bold text-[#b91c1c] border-2 border-line bg-[#fee2e2] px-3 py-2 rounded-sm">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="border-2 border-line bg-background px-3 py-1.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
        >
          {t(lang, "retry")}
        </button>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-2/3 bg-paper border-2 border-line rounded-md" />
        <div className="h-40 bg-paper border-2 border-line rounded-md" />
        <div className="h-64 bg-paper border-2 border-line rounded-md" />
      </div>
    );
  }

  const { config, demos, broll, renders } = state;
  const readyDemos = demos.filter((d) => d.status === "ready");
  const demoCount = demos.filter((d) => d.status !== "error").length;
  const blocker =
    broll.length === 0
      ? t(lang, "noBackgrounds")
      : config.hooks.length === 0
        ? t(lang, "noHooks")
        : readyDemos.length === 0
          ? t(lang, "needDemoFirst")
          : null;
  const canGenerate = !blocker && !building;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header */}
      <header>
        <div className={label}>{t(lang, "makeSection")}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">{title}</h1>
        {config.intro && (
          <p className="text-muted mt-2 max-w-prose whitespace-pre-wrap">{config.intro}</p>
        )}
        <ol className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              ["stepUpload", "stepUploadSub"],
              ["stepPick", "stepPickSub"],
              ["stepBuild", "stepBuildSub"],
            ] as const
          ).map(([k, sub], i) => (
            <li
              key={k}
              className="border-2 border-line bg-paper rounded-md p-3 flex items-start gap-3"
            >
              <span className="w-7 h-7 shrink-0 border-2 border-line bg-ink text-background rounded-sm flex items-center justify-center text-xs font-black">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-black text-sm leading-tight">{t(lang, k)}</span>
                <span className="block text-[11px] text-muted mt-0.5">{t(lang, sub)}</span>
              </span>
            </li>
          ))}
        </ol>
      </header>

      {/* Demos */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className={label}>
              {t(lang, "yourDemos")} · {demoCount} {t(lang, "demosOf")} {config.maxDemos}
            </div>
            <p className="text-sm text-muted mt-1">
              {t(lang, "demosHint")
                .replace("{min}", String(config.minDemos))
                .replace("{max}", String(config.maxDemos))}{" "}
              {t(lang, "varietyHint")}
            </p>
          </div>
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,.mov,.mp4,.m4v,.webm"
              multiple
              className="sr-only"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={demoCount >= config.demoCap}
              className="border-2 border-line bg-ink text-background px-4 py-2 rounded-md nb-shadow-sm nb-press text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              + {t(lang, "uploadDemos")}
            </button>
          </div>
        </div>

        {uploads.length > 0 && (
          <ul className="space-y-1.5">
            {uploads.map((u) => (
              <li
                key={u.key}
                className="border-2 border-line bg-background rounded-md px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold truncate min-w-0">{u.name}</span>
                  {u.error ? (
                    <span className="text-[#b91c1c] font-bold text-xs shrink-0">{u.error}</span>
                  ) : (
                    <span className="text-muted text-xs shrink-0">
                      {t(lang, "uploading")} {Math.round(u.progress * 100)}%
                    </span>
                  )}
                </div>
                {!u.error && (
                  <div className="mt-1.5 h-2 border-2 border-line rounded-sm overflow-hidden bg-paper">
                    <div
                      className="h-full bg-accent transition-[width]"
                      style={{ width: `${Math.round(u.progress * 100)}%` }}
                    />
                  </div>
                )}
                {u.error && (
                  <button
                    type="button"
                    onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}
                    className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {demos.length === 0 && uploads.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full border-2 border-dashed border-line bg-paper rounded-md p-8 text-center text-sm font-bold text-muted nb-press"
          >
            {t(lang, "noDemosYet")}
          </button>
        ) : (
          <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {demos.map((d) => (
              <li
                key={d.id}
                className="border-2 border-line bg-background rounded-md overflow-hidden"
              >
                <div className="relative aspect-[9/16] bg-paper">
                  {d.posterUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={d.posterUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {d.status === "error" ? (
                        <span className="text-2xl" aria-hidden>
                          ⚠️
                        </span>
                      ) : (
                        <span className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
                      )}
                    </div>
                  )}
                  <div className="absolute top-1 left-1">
                    <StatusPill status={d.status} lang={lang} />
                  </div>
                  {d.durationSec != null && (
                    <span className="absolute bottom-1 right-1 border-2 border-line bg-background px-1 text-[9px] font-black rounded-sm">
                      {fmtSec(d.durationSec)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteClip(d.id)}
                    aria-label={t(lang, "deleteWord")}
                    title={t(lang, "deleteWord")}
                    className="absolute top-1 right-1 w-6 h-6 border-2 border-line bg-background rounded-sm text-xs font-black nb-press"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-1.5 py-1">
                  <div className="text-[11px] font-bold truncate">
                    {d.label || d.filename || t(lang, "untitledDemo")}
                  </div>
                  {d.status === "error" && d.error && (
                    <div className="text-[10px] text-[#b91c1c] leading-tight mt-0.5">
                      {d.error}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Generate */}
      <section className="border-2 border-line bg-background rounded-md nb-shadow p-4 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              {t(lang, "generateVideo")}
            </h2>
            <p className="text-sm text-muted mt-1 max-w-prose">{t(lang, "generateHint")}</p>
            <p className="text-[11px] text-muted mt-1">
              {readyDemos.length} {readyDemos.length === 1 ? t(lang, "untitledDemo").toLowerCase() : "demos"}{" "}
              {t(lang, "readyWord")} · {config.hooks.length} {t(lang, "hooksWord")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!canGenerate}
            className="shrink-0 border-2 border-line bg-accent text-accent-ink px-8 py-4 rounded-md nb-shadow nb-press font-black uppercase tracking-widest text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {building ? `${t(lang, "building")}…` : `🎬 ${t(lang, "generateVideo")}`}
          </button>
        </div>
        {blocker && !building && (
          <p className="text-sm font-bold text-muted border-2 border-dashed border-line bg-paper rounded-md px-3 py-2">
            {blocker}
          </p>
        )}
        {buildError && (
          <p className="text-sm font-bold text-[#b91c1c] border-2 border-line bg-[#fee2e2] px-3 py-2 rounded-sm">
            {buildError}
          </p>
        )}
      </section>

      {/* Library */}
      <section className="space-y-3" ref={resultRef}>
        <div className={label}>
          {t(lang, "yourVideos")} · {renders.length}
        </div>
        {renders.length === 0 ? (
          <p className="text-sm text-muted border-2 border-dashed border-line bg-paper rounded-md p-6 text-center">
            {t(lang, "noVideosYet")}
          </p>
        ) : (
          <ul className="space-y-3">
            {renders.map((r) => (
              <RenderCard
                key={r.id}
                render={r}
                lang={lang}
                open={r.id === justBuilt || r.id === renders[0].id}
                onDelete={() => void deleteRender(r.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RenderCard({
  render: r,
  lang,
  open,
  onDelete,
}: {
  render: StudioRender;
  lang: Lang;
  open: boolean;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(open);
  // Re-open when the parent asks (a fresh build lands at the top).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setExpanded(true);
  }
  const busy = r.status === "queued" || r.status === "processing";
  return (
    <li className="border-2 border-line bg-background rounded-md nb-shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full text-left flex items-center gap-3 p-3"
      >
        <span className="w-12 shrink-0 aspect-[9/16] border-2 border-line bg-paper rounded-sm overflow-hidden flex items-center justify-center">
          {r.posterUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={r.posterUrl} alt="" className="w-full h-full object-cover" />
          ) : busy ? (
            <span className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
          ) : (
            <span aria-hidden>⚠️</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-black leading-snug truncate">{r.hookText}</span>
          <span className="block text-[11px] text-muted mt-0.5">
            {new Date(r.createdAt).toLocaleString()}
            {r.durationSec != null ? ` · ${fmtSec(r.durationSec)}` : ""}
          </span>
        </span>
        <StatusPill status={r.status} lang={lang} />
        <span className="text-muted text-xs" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="border-t-2 border-line p-3 sm:p-4 space-y-3">
          {r.status === "error" && (
            <p className="text-sm font-bold text-[#b91c1c] border-2 border-line bg-[#fee2e2] px-3 py-2 rounded-sm">
              {r.error ?? t(lang, "failed")}
            </p>
          )}
          {busy && (
            <p className="text-sm text-muted flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
              {r.status === "queued" ? t(lang, "queued") : t(lang, "building")}…
            </p>
          )}
          {r.status === "ready" && r.url && (
            <div className="grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-4">
              <div className="space-y-2">
                <video
                  src={r.url}
                  poster={r.posterUrl ?? undefined}
                  controls
                  playsInline
                  preload="none"
                  className="w-full max-w-[220px] mx-auto aspect-[9/16] bg-ink border-2 border-line rounded-md"
                />
                <a
                  href={`${r.url}?download=1`}
                  download
                  className="block text-center border-2 border-line bg-ink text-background px-3 py-2 rounded-md nb-press text-xs font-black uppercase tracking-widest"
                >
                  ⬇ {t(lang, "download")}
                </a>
                <p className="text-[11px] text-muted text-center">{t(lang, "videoReadyHint")}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className={label}>{t(lang, "captionHeading")}</div>
                  <CopyButton value={r.caption} text={t(lang, "copyCaption")} lang={lang} />
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed border-2 border-line bg-paper rounded-md p-3 select-all">
                  {r.caption}
                </pre>
                <p className="text-[11px] text-muted">{t(lang, "postEverywhere")}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onDelete}
              className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-[#b91c1c]"
            >
              {t(lang, "deleteWord")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
