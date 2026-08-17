"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Onboarding, OnboardingBlock } from "@/lib/db";
import { RichText } from "@/components/RichText";
import { VideoCarousel } from "@/components/VideoCarousel";
import { LanguageToggle } from "@/components/LanguageToggle";
import { t, type Lang } from "@/lib/i18n";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-accent text-sm tracking-tight" aria-label={`${n} stars`}>
      {"★".repeat(Math.max(0, Math.min(5, n)))}
      <span className="text-line/30">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

function VideoEmbed({ url, lang = "en" }: { url: string; lang?: Lang }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) {
    return (
      <iframe
        className="w-full aspect-video border-2 border-line rounded-md bg-black"
        src={`https://www.youtube.com/embed/${yt[1]}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/api/uploads")) {
    return (
      <video
        src={url}
        controls
        playsInline
        className="w-full max-h-[60vh] border-2 border-line rounded-md bg-black"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex border-2 border-line bg-accent text-accent-ink px-3 py-2 rounded-md nb-press text-sm font-black uppercase tracking-widest"
    >
      {t(lang, "watchVideo")}
    </a>
  );
}

function Block({
  block,
  answer,
  onAnswer,
  lang = "en",
}: {
  block: OnboardingBlock;
  answer: unknown;
  onAnswer: (v: unknown) => void;
  lang?: Lang;
}) {
  if (block.kind === "text") {
    return <RichText html={block.text} />;
  }
  if (block.kind === "image") {
    if (!block.url) return null;
    return (
      <figure className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.url}
          alt={block.caption ?? ""}
          className="w-full h-auto border-2 border-line rounded-md bg-paper"
        />
        {block.caption && (
          <figcaption className="text-sm text-muted text-center">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.kind === "video") {
    if (!block.url) return null;
    return (
      <div className="space-y-2">
        <VideoEmbed url={block.url} lang={lang} />
        {block.caption && (
          <p className="text-sm text-muted text-center">{block.caption}</p>
        )}
      </div>
    );
  }
  if (block.kind === "videos") {
    if (block.videos.length === 0) return null;
    return (
      <div className="space-y-2">
        {block.heading && (
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            {block.heading}
          </div>
        )}
        <VideoCarousel videos={block.videos} />
      </div>
    );
  }
  if (block.kind === "reviews") {
    const showCard = block.showCard !== false && !!block.appName;
    if (!showCard && block.reviews.length === 0) return null;
    return (
      <div className="space-y-4">
        {showCard && (
          <div className="border-2 border-line bg-background rounded-md nb-shadow p-4 flex items-center gap-4">
            {block.appIcon && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={block.appIcon}
                alt=""
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-line bg-paper shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-lg sm:text-xl font-black leading-tight truncate">
                {block.appName}
              </div>
              {block.appSubtitle && (
                <div className="text-sm text-muted truncate">
                  {block.appSubtitle}
                </div>
              )}
              {!!block.appRating && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Stars n={Math.round(block.appRating)} />
                  <span className="text-sm font-black">
                    {block.appRating.toFixed(1)}
                  </span>
                  {block.appRatingCount ? (
                    <span className="text-xs text-muted">
                      · {block.appRatingCount.toLocaleString()} ratings
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
        {block.reviews.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {block.reviews.map((r, i) => (
          <div
            key={i}
            className="border-2 border-line bg-paper rounded-md nb-shadow-sm p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <Stars n={r.rating} />
              <span className="text-[11px] font-bold text-muted truncate">
                {r.author}
              </span>
            </div>
            {r.title && <div className="font-black leading-tight">{r.title}</div>}
            <p className="text-sm text-ink leading-relaxed">{r.body}</p>
          </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  // question
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-black flex items-center gap-1">
        {block.label || t(lang, "question")}
        {block.required && <span className="text-accent">*</span>}
      </span>
      {block.field === "long" ? (
        <textarea
          value={(answer as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          rows={4}
          placeholder={block.placeholder}
          className="w-full border-2 border-line rounded-md px-3 py-2 text-base focus:outline-none focus:border-accent bg-background leading-relaxed"
        />
      ) : block.field === "select" ? (
        <select
          value={(answer as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          className="w-full border-2 border-line rounded-md px-3 py-2 text-base font-bold bg-background focus:outline-none focus:border-accent"
        >
          <option value="">{t(lang, "choose")}</option>
          {(block.options ?? [])
            .filter((o) => o.trim())
            .map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
        </select>
      ) : block.field === "checkbox" ? (
        <span className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!answer}
            onChange={(e) => onAnswer(e.target.checked)}
            className="w-5 h-5"
          />
          <span className="text-sm text-ink-soft">
            {block.placeholder || t(lang, "yes")}
          </span>
        </span>
      ) : (
        <input
          type="text"
          value={(answer as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder={block.placeholder}
          className="w-full border-2 border-line rounded-md px-3 py-2 text-base focus:outline-none focus:border-accent bg-background"
        />
      )}
    </label>
  );
}

export function OnboardingFlow({
  onboarding,
  brief,
  gated = false,
  requireLogin = true,
  account = null,
  lang = "en",
}: {
  onboarding: Onboarding;
  brief: { slug: string; name: string; logoUrl: string | null };
  gated?: boolean;
  requireLogin?: boolean;
  account?: { name: string | null; email: string } | null;
  lang?: Lang;
}) {
  const router = useRouter();
  const steps = onboarding.steps;
  // When gated, a final "enter the code" screen follows the steps.
  const total = steps.length + (gated ? 1 : 0);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [i]);

  // Resume where they left off: restore the saved step AND answers on mount,
  // save on change. (Restoring the step without the answers used to land
  // returning creators on the final gate with an empty submission.)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sb-step-${brief.slug}`);
      const n = raw == null ? NaN : parseInt(raw, 10);
      if (!Number.isNaN(n)) setI(Math.max(0, Math.min(total - 1, n)));
      const ans = localStorage.getItem(`sb-answers-${brief.slug}`);
      if (ans) setAnswers(JSON.parse(ans) as Record<string, unknown>);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(`sb-step-${brief.slug}`, String(i));
    } catch {
      /* ignore */
    }
  }, [i, brief.slug]);
  useEffect(() => {
    try {
      localStorage.setItem(`sb-answers-${brief.slug}`, JSON.stringify(answers));
    } catch {
      /* ignore */
    }
  }, [answers, brief.slug]);

  function clearSaved() {
    try {
      localStorage.removeItem(`sb-step-${brief.slug}`);
      localStorage.removeItem(`sb-answers-${brief.slug}`);
    } catch {
      /* ignore */
    }
  }

  const onGate = gated && i === steps.length;
  const step = steps[i]; // undefined on the gate screen
  const isLastStep = i === steps.length - 1;

  // Final-gate form state.
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gPassword, setGPassword] = useState("");
  const [gCode, setGCode] = useState("");
  const [gErr, setGErr] = useState<string | null>(null);
  const [gBusy, setGBusy] = useState(false);

  // Stable per-device id so a creator who finishes onboarding and later enters
  // the code updates one record (moves from the onboarded list to approved).
  const clientId = useRef("");
  useEffect(() => {
    try {
      const k = `sb-cid-${brief.slug}`;
      let v = localStorage.getItem(k);
      if (!v) {
        v = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(k, v);
      }
      clientId.current = v;
    } catch {
      /* ignore */
    }
  }, [brief.slug]);

  // Capture a "finished onboarding" lead (no code yet) — fired when they tap
  // the WhatsApp/contact CTA on the gate screen.
  function recordOnboarded() {
    if (!gName.trim()) return;
    void fetch(`/api/access/${encodeURIComponent(brief.slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: gName.trim(),
        answers,
        clientId: clientId.current,
        mode: "onboarded",
      }),
    }).catch(() => {});
  }

  // Block advancing while a required question on this step is unanswered.
  const blocked =
    !onGate &&
    !!step &&
    step.blocks.some(
      (b) =>
        b.kind === "question" &&
        b.required &&
        (answers[b.id] === undefined ||
          answers[b.id] === "" ||
          answers[b.id] === false)
    );

  function next() {
    if (onGate || blocked) return;
    if (isLastStep) {
      if (gated) setI(steps.length);
      else {
        clearSaved();
        router.push(`/b/${brief.slug}/calendar`);
      }
    } else {
      setI((n) => n + 1);
    }
  }

  // Login is needed only when the brief requires it and they're not already in.
  const needAuth = requireLogin && !account;

  async function unlock() {
    if (gBusy) return;
    if (!gCode.trim()) {
      setGErr(t(lang, "errEnterCode"));
      return;
    }
    if (!requireLogin && !gName.trim()) {
      setGErr(t(lang, "errEnterName"));
      return;
    }
    if (needAuth) {
      if (!gEmail.trim() || !gPassword) {
        setGErr(t(lang, "errEnterEmailPw"));
        return;
      }
      if (authMode === "signup" && !gName.trim()) {
        setGErr(t(lang, "errEnterName"));
        return;
      }
    }
    setGBusy(true);
    setGErr(null);
    try {
      let userName = account?.name ?? gName.trim() ?? null;
      // 1) Sign up / log in (only when required and not already logged in).
      if (needAuth) {
        const authRes = await fetch(`/api/auth/${authMode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            authMode === "signup"
              ? { email: gEmail.trim(), password: gPassword, name: gName.trim() }
              : { email: gEmail.trim(), password: gPassword }
          ),
        });
        const aj = await authRes.json().catch(() => ({}));
        if (!authRes.ok || !aj.ok) {
          setGErr(aj.error ?? t(lang, "errSignIn"));
          setGBusy(false);
          return;
        }
        userName = gName.trim() || aj.user?.name || aj.user?.email;
      }
      // 2) Enter the brief code → records approval + sets the access cookie.
      const res = await fetch(`/api/access/${encodeURIComponent(brief.slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName || account?.email || "Creator",
          code: gCode.trim(),
          answers,
          clientId: clientId.current,
          mode: "approve",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setGErr(
          j.error === "wrong code"
            ? t(lang, "errWrongCode")
            : (j.error ?? t(lang, "errGeneric"))
        );
        setGBusy(false);
        return;
      }
      clearSaved();
      router.push(`/b/${brief.slug}/calendar`);
    } catch (e) {
      setGErr((e as Error).message);
      setGBusy(false);
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-background text-ink overflow-hidden">
      <header className="shrink-0 border-b-2 border-line bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 border-2 border-line bg-background rounded-md overflow-hidden flex items-center justify-center shrink-0">
            {brief.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={brief.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs font-black uppercase">{brief.name.slice(0, 2)}</span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            {brief.name} · {t(lang, "onboarding")}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <LanguageToggle lang={lang} />
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              {i + 1} / {total}
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-paper">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${((i + 1) / total) * 100}%` }}
          />
        </div>
      </header>

      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto">
        {onGate ? (
          <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-5">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              {onboarding.gate?.heading?.trim() || t(lang, "gateHeading")}
            </h1>
            <p className="text-base sm:text-lg text-ink leading-relaxed whitespace-pre-line">
              {onboarding.gate?.body?.trim() || t(lang, "gateBody")}
            </p>
            {onboarding.gate?.ctaUrl?.trim() &&
              onboarding.gate?.ctaLabel?.trim() && (
                <a
                  href={onboarding.gate.ctaUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={recordOnboarded}
                  className="flex w-full justify-center border-2 border-line bg-success text-success-ink px-4 py-3 rounded-md nb-press font-black uppercase tracking-widest text-sm"
                >
                  {onboarding.gate.ctaLabel}
                </a>
              )}
            <div className="border-2 border-line bg-paper rounded-md p-4 space-y-3">
              {!requireLogin ? (
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                    {t(lang, "yourName")}
                  </span>
                  <input
                    type="text"
                    value={gName}
                    onChange={(e) => setGName(e.target.value)}
                    onBlur={recordOnboarded}
                    placeholder={t(lang, "namePlaceholder")}
                    className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-base font-bold focus:outline-none focus:border-accent bg-background"
                  />
                </label>
              ) : account ? (
                <div className="text-sm font-bold">
                  {t(lang, "signedInAs")}{" "}
                  <span className="text-accent">{account.email}</span>
                </div>
              ) : (
                <>
                  <div className="inline-flex border-2 border-line rounded-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        authMode === "signup"
                          ? "bg-accent text-accent-ink"
                          : "bg-background text-muted"
                      }`}
                    >
                      {t(lang, "createAccount")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("login")}
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border-l-2 border-line ${
                        authMode === "login"
                          ? "bg-accent text-accent-ink"
                          : "bg-background text-muted"
                      }`}
                    >
                      {t(lang, "logIn")}
                    </button>
                  </div>

                  {authMode === "signup" && (
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                        {t(lang, "yourName")}
                      </span>
                      <input
                        type="text"
                        value={gName}
                        onChange={(e) => setGName(e.target.value)}
                        onBlur={recordOnboarded}
                        placeholder={t(lang, "namePlaceholder")}
                        className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-base font-bold focus:outline-none focus:border-accent bg-background"
                      />
                    </label>
                  )}
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                      {t(lang, "email")}
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={gEmail}
                      onChange={(e) => setGEmail(e.target.value)}
                      placeholder={t(lang, "emailPlaceholder")}
                      className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-base focus:outline-none focus:border-accent bg-background"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                      {t(lang, "password")}
                    </span>
                    <input
                      type="password"
                      autoComplete={
                        authMode === "signup" ? "new-password" : "current-password"
                      }
                      value={gPassword}
                      onChange={(e) => setGPassword(e.target.value)}
                      placeholder={
                        authMode === "signup"
                          ? t(lang, "passwordNewPlaceholder")
                          : t(lang, "passwordPlaceholder")
                      }
                      className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-base focus:outline-none focus:border-accent bg-background"
                    />
                  </label>
                </>
              )}
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
                  {t(lang, "accessCode")}
                </span>
                <input
                  type="text"
                  value={gCode}
                  onChange={(e) => setGCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void unlock();
                    }
                  }}
                  placeholder={t(lang, "codePlaceholder")}
                  className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 text-base font-mono focus:outline-none focus:border-accent bg-background"
                />
              </label>
              {gErr && (
                <p className="text-sm font-bold text-[#b91c1c]">{gErr}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
            {step.title && (
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                {step.title}
              </h1>
            )}
            {step.subtitle && (
              <p className="text-base sm:text-lg text-ink-soft leading-relaxed -mt-2">
                {step.subtitle}
              </p>
            )}
            {step.blocks.map((b) => (
              <Block
                key={b.id}
                block={b}
                answer={answers[b.id]}
                onAnswer={(v) => setAnswers((a) => ({ ...a, [b.id]: v }))}
                lang={lang}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t-2 border-line bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            className="border-2 border-line bg-background px-4 py-2.5 rounded-md nb-press font-black uppercase tracking-widest text-xs disabled:opacity-30"
          >
            {t(lang, "back")}
          </button>
          <button
            type="button"
            onClick={onGate ? unlock : next}
            disabled={onGate ? gBusy : blocked}
            className="ml-auto border-2 border-line bg-accent text-accent-ink px-6 py-2.5 rounded-md nb-press font-black uppercase tracking-widest text-xs disabled:opacity-40"
          >
            {onGate
              ? gBusy
                ? t(lang, "unlocking")
                : t(lang, "unlockBrief")
              : isLastStep
                ? gated
                  ? t(lang, "continueArrow")
                  : t(lang, "enterBrief")
                : t(lang, "next")}
          </button>
        </div>
      </footer>
    </div>
  );
}
