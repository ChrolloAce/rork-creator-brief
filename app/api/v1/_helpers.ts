import { NextResponse } from "next/server";
import { verifyApiRequest } from "@/lib/api-auth";
import type { Format, FormatAsset } from "@/lib/types";

export function requireAuth(req: Request): NextResponse | null {
  const r = verifyApiRequest(req);
  if (r.ok) return null;
  return NextResponse.json({ error: r.error }, { status: r.status });
}

// Resolve relative /api/uploads/... URLs against the incoming request's
// origin so callers get clickable absolute URLs back.
export function absolutize(req: Request, url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "";
  if (!host) return url;
  if (!url.startsWith("/")) url = `/${url}`;
  return `${proto}://${host}${url}`;
}

export function publicizeAsset(req: Request, a: FormatAsset): FormatAsset {
  return {
    ...a,
    url: absolutize(req, a.url),
  };
}

// Strip server-only fields from a Format before returning over the API.
// Keeps the response surface stable even if Format gains internal fields.
export function publicizeFormat(req: Request, f: Format) {
  return {
    slug: f.slug,
    title: f.title,
    tagline: f.tagline,
    description: f.description,
    thumbnail: f.thumbnail ?? null,
    script: f.script ?? null,
    bestFor: f.bestFor.map(toItem),
    structure: f.structure.map(toItem),
    tips: f.tips.map(toItem),
    hookCategorySlugs: f.hookCategorySlugs,
    examples: f.examples.map((v) => ({
      platform: v.platform,
      url: v.url,
      id: v.id,
      dbId: v.dbId ?? null,
      title: v.title ?? null,
      caption: v.caption ?? null,
      thumbnail: v.thumbnail,
      views: v.views ?? null,
      likes: v.likes ?? null,
      comments: v.comments ?? null,
      shares: v.shares ?? null,
      uploadDate: v.uploadDate ?? null,
      creator: v.creator,
      creatorUrl: v.creatorUrl ?? null,
    })),
    hiddenSections: f.hiddenSections ?? [],
    sectionOrder: f.sectionOrder ?? null,
    assets: (f.assets ?? []).map((a) => publicizeAsset(req, a)),
  };
}

function toItem(i: string | { text: string; image?: string; hidden?: boolean }) {
  if (typeof i === "string") return { text: i, image: null, hidden: false };
  return {
    text: i.text,
    image: i.image ?? null,
    hidden: !!i.hidden,
  };
}
