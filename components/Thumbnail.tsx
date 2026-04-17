import type { Platform } from "@/lib/types";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "w-12 h-12",
  md: "w-14 h-14 sm:w-16 sm:h-16",
  lg: "w-20 h-20 sm:w-24 sm:h-24",
};

const platformBadge: Partial<Record<Platform, string>> = {
  instagram: "IG",
  tiktok: "TT",
  x: "X",
  youtube: "YT",
};

export function Thumbnail({
  src,
  slug,
  size = "md",
  alt,
  platform,
}: {
  src?: string;
  slug: string;
  size?: Size;
  alt?: string;
  platform?: Platform;
}) {
  const cls = sizeClasses[size];
  if (src) {
    return (
      <div
        className={`${cls} relative border-2 border-line overflow-hidden rounded-md shrink-0 nb-shadow-sm bg-paper`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? `${slug} thumbnail`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {platform && platformBadge[platform] && (
          <span className="absolute bottom-1 right-1 text-[9px] font-black bg-background text-ink px-1 py-0.5 border border-line rounded-sm leading-none">
            {platformBadge[platform]}
          </span>
        )}
      </div>
    );
  }
  const label = slug
    .split("-")
    .map((w) => w[0]?.toUpperCase())
    .join("")
    .slice(0, 3);
  return (
    <div
      className={`${cls} border-2 border-line bg-accent text-accent-ink flex items-center justify-center rounded-md shrink-0 nb-shadow-sm font-black`}
      aria-hidden
    >
      <span className="text-[13px] tracking-tight">{label}</span>
    </div>
  );
}
