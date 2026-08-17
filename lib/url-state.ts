// The admin keeps where-you-are in the URL, so a refresh (or a shared link, or
// the back button) puts you back on the same tab, the same script, the same
// panel — instead of dumping you at the top.
//
// Next supports the native history methods for exactly this and wires them into
// its router (see the "Shallow routing on the client" guide). We read from
// window.location rather than useSearchParams so the component has no
// prerender/Suspense requirement and no hydration mismatch.

export function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

// Merge params into the current URL. `null` removes a key. Tab and panel
// switches replace (a view preference, not a destination); opening or closing a
// script pushes, so Back closes the studio the way you would expect.
export function writeParams(
  patch: Record<string, string | null>,
  opts: { push?: boolean } = {}
): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (opts.push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

// Re-read the URL whenever the user moves through history.
export function onHistoryChange(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
}
