"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "/admin";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(from);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({ error: "login failed" }));
      setError(j.error ?? "login failed");
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
            Admin
          </div>
          <h1 className="text-2xl font-black tracking-tight">Rork / Brief</h1>
        </div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
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
          {loading ? "…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
