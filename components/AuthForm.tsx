"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Standalone, site-wide creator login / signup. On success the session cookie
// is set by the API and we bounce to the dashboard (/).
export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
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
    const body =
      mode === "login" ? { email, password } : { name, email, password };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({ error: "Something went wrong." }));
    setLoading(false);
    if (res.ok && j.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError(j.error ?? "Something went wrong.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm border-2 border-line rounded-md nb-shadow bg-background p-6 space-y-4"
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted mb-2">
            SuperBrief
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {mode === "login"
              ? "Sign in to see your briefs."
              : "Sign up, then open your brief link to get started."}
          </p>
        </div>

        {mode === "signup" && (
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 bg-background focus:outline-none focus:border-accent"
            />
          </label>
        )}

        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus={mode === "login"}
            className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 bg-background focus:outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border-2 border-line rounded-md px-3 py-2 bg-background focus:outline-none focus:border-accent"
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
          {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          className="w-full text-sm font-bold text-muted hover:text-ink"
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
