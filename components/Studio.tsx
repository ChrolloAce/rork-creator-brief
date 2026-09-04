"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { HookVideo } from "@/lib/hook-videos";
import {
  addDaysYmd,
  type StudioAsset,
  type StudioClip,
  type StudioPublicConfig,
  type StudioRender,
} from "@/lib/studio";
import { parseScriptLines } from "@/lib/script-lines";
import { InlineRich } from "./RichText";

// The Video Builder, creator side. Two steps, one at a time:
//   1. Record your demos: how to record, example demos, reels to study, and
//      the upload. Stays until they have the minimum number of demos.
//   2. Your videos: a day strip (today, tomorrow, ...) with the videos already
//      prepared for each day, each with its caption, plus a button to generate
//      one more for that day. Demos are tucked under "Change demos".
// Everything is sized for a phone because that is where creators live.

type State = {
  viewer: { id: string; name: string | null; email: string | null; isAdmin: boolean };
  config: StudioPublicConfig;
  demos: StudioClip[];
  broll: StudioClip[];
  examples: StudioClip[];
  showcase: StudioClip[];
  library: HookVideo[];
  libraryCount: number;
  renders: StudioRender[];
  // The creator's local date, echoed back by the server.
  today: string;
  flags?: Record<string, unknown>;
};

type Upload = { key: string; name: string; progress: number; error?: string };

const label = "text-[10px] uppercase tracking-[0.2em] font-bold text-muted";

function fmtSec(s: number | null): string {
  if (s == null) return "";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

// The creator's local calendar date, "YYYY-MM-DD". Their phone decides what
// "today" is, never the server.
function localYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(ymd: string, today: string, lang: Lang): string {
  if (ymd === today) return t(lang, "todayWord");
  if (ymd === addDaysYmd(today, 1)) return t(lang, "tomorrowWord");
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === "es" ? "es" : "en", {
    weekday: "short",
    day: "numeric",
  });
}

function weekdayShort(ymd: string, lang: Lang): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString(lang === "es" ? "es" : "en", { weekday: "short" })
    .replace(/\.$/, "");
}

// iOS Safari turns <a download> into "open the video" or a Files save; the
// share sheet with the file attached is the path that lands in Photos.
function canShareFiles(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || !navigator.canShare) return false;
    return navigator.canShare({ files: [new File([new Uint8Array(1)], "v.mp4", { type: "video/mp4" })] });
  } catch {
    return false;
  }
}

// Fetch a file and hand it to the phone's share sheet (Save Video / Save
// Image). Falls back to opening the download link if sharing is refused.
async function shareUrl(url: string, name: string, mime: string): Promise<void> {
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], name, { type: mime });
  await navigator.share({ files: [file], title: name });
}

function fileNameFor(hook: string): string {
  const base = hook.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${base || "video"}.mp4`;
}

function dayLong(ymd: string, lang: Lang): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === "es" ? "es" : "en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
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
  // Step 2 hides the demos; this opens them back up to add or swap clips.
  const [manageOpen, setManageOpen] = useState(false);
  // Which calendar day is open in step 2 (null = today).
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // "I made my accounts": server-side per creator; the admin pseudo-user has
  // no roster row, so it falls back to this browser.
  const [accountsDoneLocal, setAccountsDoneLocal] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(`sb-accounts-done:${briefSlug}`) === "1") setAccountsDoneLocal(true);
    } catch {
      /* storage blocked */
    }
  }, [briefSlug]);
  async function markAccountsDone() {
    setAccountsDoneLocal(true);
    try {
      localStorage.setItem(`sb-accounts-done:${briefSlug}`, "1");
    } catch {
      /* storage blocked */
    }
    await fetch(`/api/studio/${encodeURIComponent(briefSlug)}/flags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "accountsDone", value: true }),
    }).catch(() => {});
  }
  const fileInput = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/studio/${encodeURIComponent(briefSlug)}/state?today=${localYmd()}`,
        { cache: "no-store" }
      );
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
  async function generate(day: string) {
    if (!state) return;
    setBuilding(true);
    setBuildError(null);
    try {
      const res = await fetch(`/api/studio/${encodeURIComponent(briefSlug)}/renders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor: day }),
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
  const minDemos = Math.max(1, config.minDemos);
  const unlocked = readyDemos.length >= minDemos;
  const step: 1 | 2 = unlocked ? 2 : 1;

  const library = config.opening === "library";
  const libraryCount = state.libraryCount ?? 0;
  const blocker = library
    ? libraryCount === 0
      ? t(lang, "noLibrary")
      : readyDemos.length === 0
        ? t(lang, "needDemoFirst")
        : null
    : broll.length === 0
      ? t(lang, "noBackgrounds")
      : config.hooks.length === 0
        ? t(lang, "noHooks")
        : readyDemos.length === 0
          ? t(lang, "needDemoFirst")
          : null;
  const canGenerate = !blocker && !building;

  // Calendar: today plus the days ahead, at least a week so there is always
  // somewhere to schedule into.
  const today = state.today;
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(today, i));
  const day = selectedDay && days.includes(selectedDay) ? selectedDay : today;
  const dayIdx = days.indexOf(day);
  const forDay = (d: string) => renders.filter((r) => r.scheduledFor === d);
  const dayRenders = forDay(day);
  const accountsDone = accountsDoneLocal || state.flags?.accountsDone === true;
  const earlier = renders.filter((r) => r.scheduledFor < today);
  const inFillWindow = days.indexOf(day) < config.daysAhead;
  const dayBusy = dayRenders.some((r) => r.status === "queued" || r.status === "processing");

  const demosPanel = (
    <DemosPanel
      state={state}
      uploads={uploads}
      lang={lang}
      fileInput={fileInput}
      onFiles={onFiles}
      onDelete={deleteClip}
      onDismissUpload={(key) => setUploads((x) => x.filter((y) => y.key !== key))}
      minDemos={minDemos}
      demoCount={demoCount}
      readyCount={readyDemos.length}
    />
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <header>
        <div className={label}>{t(lang, "makeSection")}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">{title}</h1>
        {config.intro && step === 2 && (
          <p className="text-muted mt-2 max-w-prose whitespace-pre-wrap">{config.intro}</p>
        )}
      </header>

      {step === 1 && (
        <ol className="space-y-4">
          {(() => {
            let n = 0;
            const next = () => ++n;
            const showcase = state.showcase;
            const hasHowTo =
              !!config.script || config.createGuide.length > 0 || config.assets.length > 0;
            const loose = config.assets.filter((a) => !a.at);
            return (
              <>
                <GsStep n={next()} title={t(lang, "gs1Title")}>
                  <p className="text-base sm:text-lg leading-snug">
                    <InlineRich text={t(lang, "gs1Body")} />
                  </p>
                  <div className="mt-3">
                    <div className={label}>{t(lang, "postTo")}</div>
                    <ul className="mt-1.5 grid grid-cols-3 gap-2">
                      <PlatformTile name="TikTok" icon={<TikTokIcon />} />
                      <PlatformTile name="Instagram" icon={<InstagramIcon />} />
                      <PlatformTile name="YouTube" icon={<YouTubeIcon />} />
                    </ul>
                  </div>
                  {(config.payCpm || config.payMaxPerVideo || config.payoutCadence) && (
                    <ul className="mt-3 grid grid-cols-3 gap-2">
                      {config.payCpm && (
                        <StatTile big={config.payCpm} small={t(lang, "perThousandViews")} />
                      )}
                      {config.payMaxPerVideo && (
                        <StatTile
                          big={config.payMaxPerVideo}
                          small={
                            t(lang, "perCrossPost") +
                            (config.payCapViews ? ` · ${t(lang, "viewCap").replace("{n}", config.payCapViews)}` : "")
                          }
                          accent
                        />
                      )}
                      {config.payoutCadence && (
                        <StatTile big={config.payoutCadence} small={t(lang, "payoutsWord")} />
                      )}
                    </ul>
                  )}
                </GsStep>
                {showcase.length > 0 && (
                  <GsStep n={next()} title={t(lang, "outcomeHeading")}>
                    <ul className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                      {showcase.map((e) => (
                        <li key={e.id} className="shrink-0 w-56 sm:w-64">
                          <video
                            src={e.url ?? undefined}
                            poster={e.posterUrl ?? undefined}
                            controls
                            playsInline
                            preload="metadata"
                            className="w-full aspect-[9/16] bg-ink border-2 border-line rounded-md object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  </GsStep>
                )}
                {hasHowTo && (
                  <GsStep n={next()} title={t(lang, "gs3Title")}>
                    <div className="space-y-4">
                      {config.script && (
                        <ScriptBlock script={config.script} assets={config.assets} lang={lang} />
                      )}
                      {config.createGuide.length > 0 && (
                        <ol className="space-y-1.5">
                          {config.createGuide.map((line, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm leading-snug">
                              <span className="w-5 h-5 shrink-0 border-2 border-line bg-paper rounded-sm flex items-center justify-center text-[10px] font-black mt-0.5">
                                {i + 1}
                              </span>
                              <span>{line}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {loose.length > 0 && (
                        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {loose.map((a) => (
                            <AssetTile key={a.id} asset={a} lang={lang} />
                          ))}
                        </ul>
                      )}
                    </div>
                  </GsStep>
                )}
                <GsStep n={next()} title={t(lang, "gs4Title")}>
                  <p className="text-sm leading-snug mb-3">
                    <InlineRich text={t(lang, "gs4Body")} />
                  </p>
                  {demosPanel}
                </GsStep>
              </>
            );
          })()}
        </ol>
      )}

      {step === 2 && (
        <ol className="grid grid-cols-2 gap-2">
          <StepTile
            n={1}
            active={false}
            done
            title={t(lang, "stepRecord")}
            sub={`${readyDemos.length} ${t(lang, "ready").toLowerCase()}`}
            lang={lang}
          />
          <StepTile
            n={2}
            active
            done={false}
            title={t(lang, "stepGenerate")}
            sub={t(lang, "stepGenerateSub")}
            lang={lang}
          />
        </ol>
      )}

      {step === 2 && config.accountsGuide.length > 0 && !accountsDone && (
        <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
          <h2 className="text-xl font-black leading-tight">{t(lang, "accountsTitle")}</h2>
          <ol className="mt-3 space-y-2">
            {config.accountsGuide.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base leading-snug">
                <span className="w-5 h-5 shrink-0 border-2 border-line bg-paper rounded-sm flex items-center justify-center text-[10px] font-black mt-0.5">
                  {i + 1}
                </span>
                <span>
                  <InlineRich text={line} />
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => void markAccountsDone()}
            className="mt-4 border-2 border-line bg-ink text-background px-4 py-2.5 rounded-md nb-press text-xs font-black uppercase tracking-widest"
          >
            ✓ {t(lang, "accountsDone")}
          </button>
        </section>
      )}

      {step === 2 && (
        <>
          {/* Week bar: seven fixed tiles ("Wed 2"), arrows step the day. */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedDay(days[dayIdx - 1])}
              disabled={dayIdx <= 0}
              aria-label={t(lang, "prevDay")}
              className="w-9 h-11 shrink-0 border-2 border-line rounded-md bg-background nb-press font-black text-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <ol className="grid grid-cols-7 gap-1 flex-1 min-w-0">
              {days.map((d) => {
                const on = d === day;
                const isToday = d === today;
                return (
                  <li key={d} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDay(d)}
                      aria-pressed={on}
                      aria-label={dayLong(d, lang)}
                      className={`w-full h-11 border-2 rounded-md flex flex-col items-center justify-center leading-none ${
                        on
                          ? "bg-ink text-background border-line nb-shadow-sm"
                          : `bg-background nb-press ${isToday ? "border-accent" : "border-line"}`
                      }`}
                    >
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${on ? "opacity-70" : "text-muted"}`}>
                        {weekdayShort(d, lang)}
                      </span>
                      <span className="text-sm font-black mt-0.5">{Number(d.slice(8, 10))}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              onClick={() => setSelectedDay(days[dayIdx + 1])}
              disabled={dayIdx >= days.length - 1}
              aria-label={t(lang, "nextDay")}
              className="w-9 h-11 shrink-0 border-2 border-line rounded-md bg-background nb-press font-black text-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>

          {/* The day */}
          <section className="space-y-3" ref={resultRef}>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <div className={label}>{t(lang, "videosForDay").replace("{day}", dayLabel(day, today, lang))}</div>
                <div className="font-black text-lg leading-tight capitalize">{dayLong(day, lang)}</div>
              </div>
              <button
                type="button"
                onClick={() => void generate(day)}
                disabled={!canGenerate}
                className="border-2 border-line bg-accent text-accent-ink px-4 py-2.5 rounded-md nb-shadow-sm nb-press text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {building
                  ? `${t(lang, "building")}…`
                  : `🎬 ${t(lang, "generateForDay").replace("{day}", dayLabel(day, today, lang))}`}
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
            {dayRenders.length === 0 ? (
              <p className="text-sm text-muted border-2 border-dashed border-line bg-paper rounded-md p-6 text-center">
                {!blocker && config.autoFill && config.perDay > 0 && inFillWindow
                  ? t(lang, "preparingVideos")
                  : t(lang, "noVideosDay")}
              </p>
            ) : (
              <ul className="space-y-3">
                {dayRenders.map((r, i) => (
                  <RenderCard
                    key={r.id}
                    render={r}
                    lang={lang}
                    open={r.id === justBuilt || (i === 0 && !dayBusy)}
                    onDelete={() => void deleteRender(r.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <CreateSection config={config} showcase={state.showcase} lang={lang} />

          {/* Earlier */}
          {earlier.length > 0 && (
            <details className="group">
              <summary className={`${label} cursor-pointer list-none flex items-center gap-2`}>
                <span className="group-open:rotate-90 transition-transform" aria-hidden>
                  ▶
                </span>
                {t(lang, "earlierVideos")} · {earlier.length}
              </summary>
              <ul className="space-y-3 mt-3">
                {earlier.map((r) => (
                  <RenderCard
                    key={r.id}
                    render={r}
                    lang={lang}
                    open={false}
                    onDelete={() => void deleteRender(r.id)}
                  />
                ))}
              </ul>
            </details>
          )}

          {/* Demos, tucked away */}
          <section className="border-t-2 border-line pt-4 space-y-3">
            <button
              type="button"
              onClick={() => setManageOpen((x) => !x)}
              className="w-full flex items-center justify-between gap-3 text-left"
            >
              <span className={label}>
                {t(lang, "yourDemos")} · {demoCount}
              </span>
              <span className="border-2 border-line bg-background px-3 py-1.5 rounded-md nb-press text-[10px] font-black uppercase tracking-widest">
                {manageOpen ? t(lang, "hideDemos") : t(lang, "changeDemos")}
              </span>
            </button>
            {manageOpen && demosPanel}
          </section>
        </>
      )}
    </div>
  );
}

function StepTile({
  n,
  active,
  done,
  locked = false,
  title,
  sub,
  lang,
}: {
  n: number;
  active: boolean;
  done: boolean;
  locked?: boolean;
  title: string;
  sub: string;
  lang: Lang;
}) {
  return (
    <li
      className={`border-2 border-line rounded-md p-3 flex items-start gap-3 ${
        active ? "bg-ink text-background nb-shadow-sm" : done ? "bg-success text-success-ink" : "bg-paper"
      } ${locked && !active ? "opacity-60" : ""}`}
    >
      <span
        className={`w-7 h-7 shrink-0 border-2 rounded-sm flex items-center justify-center text-xs font-black ${
          active ? "border-background bg-background text-ink" : "border-line bg-background text-ink"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[9px] uppercase tracking-[0.2em] font-bold ${active || done ? "opacity-70" : "text-muted"}`}
        >
          {t(lang, "stepWord")} {n}
          {locked && !active ? ` · ${t(lang, "lockedWord")}` : ""}
        </span>
        <span className="block font-black text-sm leading-tight">{title}</span>
        <span className={`block text-[11px] mt-0.5 ${active || done ? "opacity-80" : "text-muted"}`}>
          {sub}
        </span>
      </span>
    </li>
  );
}

/* ------------------------ step 1: getting started ----------------------- */

function PlatformTile({ name, icon }: { name: string; icon: React.ReactNode }) {
  return (
    <li className="border-2 border-line bg-paper rounded-md p-2 flex flex-col items-center gap-1">
      <span className="w-9 h-9 flex items-center justify-center">{icon}</span>
      <span className="text-[11px] font-black">{name}</span>
    </li>
  );
}

function StatTile({ big, small, accent = false }: { big: string; small: string; accent?: boolean }) {
  return (
    <li
      className={`border-2 border-line rounded-md p-2 text-center ${accent ? "bg-accent text-accent-ink" : "bg-background"}`}
    >
      <span className="block text-lg sm:text-xl font-black leading-tight">{big}</span>
      <span className={`block text-[10px] font-bold leading-tight mt-0.5 ${accent ? "opacity-90" : "text-muted"}`}>
        {small}
      </span>
    </li>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
      <path
        fill="#0a0a0a"
        d="M16.6 3c.3 2.6 1.9 4.2 4.4 4.4v3.2c-1.6 0-3.1-.5-4.4-1.4v6.5c0 3.5-2.8 5.8-6 5.8S4.6 19.2 4.6 15.7c0-3.6 3-6.2 6.6-5.7v3.3c-1.8-.5-3.4.8-3.4 2.4 0 1.5 1.2 2.6 2.7 2.6s2.7-1.1 2.7-2.6V3h3.4z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#E1306C" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="#E1306C" strokeWidth="2.2" />
      <circle cx="17.3" cy="6.7" r="1.3" fill="#E1306C" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="4.5" fill="#FF0000" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="#ffffff" />
    </svg>
  );
}

function GsStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-9 h-9 shrink-0 border-2 border-line bg-ink text-background rounded-md flex items-center justify-center text-lg font-black">
          {n}
        </span>
        <h2 className="text-xl sm:text-2xl font-black leading-tight">{title}</h2>
      </div>
      {children}
    </li>
  );
}

/* --------------------------- step 1: demos ------------------------------ */

function DemosPanel({
  state,
  uploads,
  lang,
  fileInput,
  onFiles,
  onDelete,
  onDismissUpload,
  minDemos,
  demoCount,
  readyCount,
}: {
  state: State;
  uploads: Upload[];
  lang: Lang;
  fileInput: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
  onDelete: (id: string) => void;
  onDismissUpload: (key: string) => void;
  minDemos: number;
  demoCount: number;
  readyCount: number;
}) {
  const { config, demos } = state;
  const remaining = Math.max(0, minDemos - readyCount);
  const pct = Math.min(100, Math.round((readyCount / minDemos) * 100));

  return (
    <div className="space-y-5">
      {/* Upload + progress */}
      <section className="border-2 border-line bg-background rounded-md nb-shadow-sm p-4 space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className={label}>{t(lang, "yourDemos")}</div>
            <div className="font-black text-lg leading-tight mt-0.5">
              {t(lang, "uploadedOf")
                .replace("{n}", String(readyCount))
                .replace("{min}", String(minDemos))}
            </div>
            <p className="text-xs text-muted mt-0.5">
              {remaining > 0
                ? t(lang, "uploadMore").replace("{n}", String(remaining))
                : t(lang, "varietyHint")}
            </p>
          </div>
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,.mov,.mp4,.m4v,.webm"
              multiple
              className="sr-only"
              onChange={(e) => onFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={demoCount >= config.demoCap}
              className="border-2 border-line bg-accent text-accent-ink px-4 py-2.5 rounded-md nb-shadow-sm nb-press text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              + {t(lang, "uploadDemos")}
            </button>
          </div>
        </div>
        <div className="h-2.5 border-2 border-line rounded-sm overflow-hidden bg-paper">
          <div className="h-full bg-success transition-[width]" style={{ width: `${pct}%` }} />
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
                    onClick={() => onDismissUpload(u.key)}
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
                    onClick={() => onDelete(d.id)}
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
    </div>
  );
}

/* ------------------------------- script --------------------------------- */

// The lines a creator reads while recording, with the timestamp each one
// lands on. Same "00:03 line" convention as the format scripts.
function ScriptBlock({
  script,
  assets = [],
  lang,
}: {
  script: string;
  assets?: StudioAsset[];
  lang: Lang;
}) {
  const lines = parseScriptLines(script);
  if (lines.length === 0) return null;
  const pinned = (ts: string | undefined) => (ts ? assets.filter((a) => a.at === ts) : []);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className={label}>{t(lang, "scriptToFollow")}</div>
          <p className="text-xs text-muted mt-0.5">{t(lang, "scriptHint")}</p>
        </div>
        <CopyButton value={script} text={t(lang, "copyScript")} lang={lang} tone="plain" />
      </div>
      <ol className="mt-2 border-2 border-line bg-paper rounded-md divide-y-2 divide-line">
        {lines.map((l, i) => {
          const here = pinned(l.timestamp);
          return (
            <li key={i} className="px-3 py-2">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-12 border-2 border-line bg-background rounded-sm text-center text-[10px] font-black py-0.5 font-mono mt-0.5">
                  {l.timestamp ?? `#${i + 1}`}
                </span>
                <span className="text-sm leading-snug font-medium flex-1 min-w-0">{l.body}</span>
              </div>
              {here.length > 0 && (
                <ul className="mt-2 ml-[60px] flex flex-wrap gap-2">
                  {here.map((a) => (
                    <PinnedAsset key={a.id} asset={a} lang={lang} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// An overlay pinned to a script line: thumbnail, what it is, and Download.
function useSaveButton(asset: StudioAsset) {
  const [shareable, setShareable] = useState(false);
  useEffect(() => {
    const ok = canShareFiles();
    if (ok) setShareable(true);
  }, []);
  const [saving, setSaving] = useState(false);
  const isVideo = asset.mime.startsWith("video/");
  const dl = `${asset.url}${asset.url.includes("?") ? "&" : "?"}download=1`;
  const name = asset.filename || `${asset.label || "asset"}.${isVideo ? "mp4" : "png"}`;
  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await shareUrl(asset.url, name, asset.mime);
    } catch {
      /* cancelled or unsupported for this type; the link still works */
    } finally {
      setSaving(false);
    }
  }
  return { shareable, saving, save, dl };
}

function PinnedAsset({ asset, lang }: { asset: StudioAsset; lang: Lang }) {
  const isImage = asset.mime.startsWith("image/");
  const isVideo = asset.mime.startsWith("video/");
  const { shareable, saving, save, dl } = useSaveButton(asset);
  return (
    <li className="flex items-center gap-2 border-2 border-line bg-background rounded-md p-1.5 pr-2 max-w-full">
      <span className="w-14 h-14 shrink-0 border-2 border-line bg-paper rounded-sm overflow-hidden flex items-center justify-center">
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={asset.url} alt="" className="w-full h-full object-contain" loading="lazy" />
        ) : isVideo ? (
          <video src={asset.url} muted playsInline preload="metadata" className="w-full h-full object-cover bg-ink" />
        ) : (
          <span className="text-[9px] font-bold text-muted">file</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold leading-tight truncate max-w-[140px]">
          {asset.label?.trim() || asset.filename || (isImage ? "Image" : "Video")}
        </span>
        <span className="block text-[9px] uppercase tracking-widest font-bold text-muted">
          {isVideo ? t(lang, "videoWord") : "overlay"}
        </span>
      </span>
      {shareable ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="shrink-0 border-2 border-line bg-ink text-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
          aria-label={t(lang, "saveToPhotos")}
        >
          {saving ? "…" : `⬇ ${t(lang, "saveWord")}`}
        </button>
      ) : (
        <a
          href={dl}
          download
          className="shrink-0 border-2 border-line bg-ink text-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
        >
          ⬇
        </a>
      )}
    </li>
  );
}

/* ------------------------- how to create + assets ----------------------- */

function AssetTile({ asset, lang }: { asset: StudioAsset; lang: Lang }) {
  const isImage = asset.mime.startsWith("image/");
  const isVideo = asset.mime.startsWith("video/");
  const { shareable, saving, save, dl } = useSaveButton(asset);
  return (
    <li className="border-2 border-line bg-background rounded-md overflow-hidden">
      <div className="aspect-square bg-paper flex items-center justify-center">
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={asset.url} alt={asset.label ?? ""} className="w-full h-full object-contain" loading="lazy" />
        ) : isVideo ? (
          <video src={asset.url} controls playsInline preload="metadata" className="w-full h-full object-contain bg-ink" />
        ) : (
          <span className="text-[10px] font-bold text-muted px-2 text-center">{asset.filename ?? asset.mime}</span>
        )}
      </div>
      <div className="p-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[11px] font-bold truncate">
          {asset.label?.trim() || asset.filename || (isImage ? "Image" : "Video")}
        </span>
        {shareable ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="shrink-0 border-2 border-line bg-ink text-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
          >
            {saving ? "…" : `⬇ ${t(lang, "saveWord")}`}
          </button>
        ) : (
          <a
            href={dl}
            download
            className="shrink-0 border-2 border-line bg-ink text-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
          >
            ⬇ {t(lang, "download")}
          </a>
        )}
      </div>
    </li>
  );
}

// "How to create your video": the guide, a finished example to play, and
// the assets to download. Open in step 1, collapsed on the calendar. Renders
// nothing when the admin has not filled any of it in.
function CreateSection({
  config,
  showcase,
  lang,
  defaultOpen = false,
}: {
  config: StudioPublicConfig;
  showcase: StudioClip[];
  lang: Lang;
  defaultOpen?: boolean;
}) {
  if (!config.script && config.createGuide.length === 0 && config.assets.length === 0 && showcase.length === 0) return null;
  // Pinned assets already sit beside their script line; the grid is for the rest.
  const loose = config.assets.filter((a) => !a.at);
  return (
    <details className="group border-2 border-line bg-background rounded-md nb-shadow-sm" open={defaultOpen}>
      <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3">
        <span>
          <span className="block font-black text-lg leading-tight">{t(lang, "howToCreate")}</span>
          <span className="block text-[11px] text-muted mt-0.5">
            {config.assets.length} {config.assets.length === 1 ? t(lang, "fileWord") : t(lang, "filesWord")}
            {showcase.length > 0 ? ` · ${t(lang, "finishedExample").toLowerCase()}` : ""}
          </span>
        </span>
        <span className="text-muted text-xs group-open:rotate-180 transition-transform" aria-hidden>
          ▼
        </span>
      </summary>
      <div className="border-t-2 border-line p-4 space-y-4">
        {config.script && !defaultOpen && (
          <ScriptBlock script={config.script} assets={config.assets} lang={lang} />
        )}
        {config.createGuide.length > 0 && (
          <ol className="space-y-1.5">
            {config.createGuide.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-snug">
                <span className="w-5 h-5 shrink-0 border-2 border-line bg-paper rounded-sm flex items-center justify-center text-[10px] font-black mt-0.5">
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        )}
        {showcase.length > 0 && !defaultOpen && (
          <div>
            <div className={label}>{t(lang, "finishedExample")}</div>
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {showcase.map((e) => (
                <li key={e.id} className="shrink-0 w-40 sm:w-44">
                  <video
                    src={e.url ?? undefined}
                    poster={e.posterUrl ?? undefined}
                    controls
                    playsInline
                    preload="none"
                    className="w-full aspect-[9/16] bg-ink border-2 border-line rounded-md object-cover"
                  />
                  {e.label && <div className="text-[10px] font-bold truncate mt-1">{e.label}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {loose.length > 0 && (
          <div>
            <div className={label}>{t(lang, "assetsToUse")}</div>
            <p className="text-xs text-muted mt-0.5">{t(lang, "assetsHint")}</p>
            <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {loose.map((a) => (
                <AssetTile key={a.id} asset={a} lang={lang} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

/* ------------------------------ render card ----------------------------- */

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
  // Share-sheet save (phones). Decided after mount so the server and client
  // render the same thing; the file is fetched on first tap and kept so a
  // second save is instant.
  const [shareable, setShareable] = useState(false);
  useEffect(() => {
    const ok = canShareFiles();
    if (ok) setShareable(true);
  }, []);
  const fileRef = useRef<File | null>(null);
  const [saving, setSaving] = useState(false);
  async function saveToPhotos() {
    if (!r.url || saving) return;
    setSaving(true);
    try {
      if (!fileRef.current) {
        const res = await fetch(r.url);
        const blob = await res.blob();
        fileRef.current = new File([blob], fileNameFor(r.hookText), { type: "video/mp4" });
      }
      await navigator.share({ files: [fileRef.current], title: r.hookText });
    } catch {
      /* cancelled or blocked; the download link below still works */
    } finally {
      setSaving(false);
    }
  }
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
            {new Date(r.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
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
                {shareable ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void saveToPhotos()}
                      disabled={saving}
                      className="block w-full text-center border-2 border-line bg-accent text-accent-ink px-3 py-2.5 rounded-md nb-shadow-sm nb-press text-xs font-black uppercase tracking-widest disabled:opacity-60"
                    >
                      {saving ? `${t(lang, "preparingShare")}…` : `⬇ ${t(lang, "saveToPhotos")}`}
                    </button>
                    <p className="text-[11px] text-muted text-center">{t(lang, "saveHint")}</p>
                    <a
                      href={`${r.url}?download=1`}
                      download
                      className="block text-center text-[10px] font-bold uppercase tracking-widest text-muted hover:text-ink"
                    >
                      {t(lang, "download")}
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href={`${r.url}?download=1`}
                      download
                      className="block text-center border-2 border-line bg-ink text-background px-3 py-2 rounded-md nb-press text-xs font-black uppercase tracking-widest"
                    >
                      ⬇ {t(lang, "download")}
                    </a>
                    <p className="text-[11px] text-muted text-center">{t(lang, "videoReadyHint")}</p>
                  </>
                )}
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
