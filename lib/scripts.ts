// Script variants — a format can hold multiple script versions for A/B
// testing. One (or more) is "live" and shown to creators; "draft" variants
// are works-in-progress; "archived" are hidden but kept for reference.
//
// Storage is backward-compatible: the legacy single `FormatOverride.script`
// string is treated as one live variant when no `scriptVariants` array exists,
// and the live variant's body is always mirrored back into `script` so the
// public page + v1 API keep working without variant-aware readers.

export type ScriptStatus = "live" | "draft" | "archived";

export type ScriptVariant = {
  id: string;
  label: string;
  body: string;
  status: ScriptStatus;
};

// Source shape we normalize from — just the script-related bits of a
// FormatOverride. Kept loose so both the db type and the editor type satisfy it.
type ScriptSource = {
  scriptVariants?: ScriptVariant[];
  script?: string;
};

export function makeVariantId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `v_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function coerceStatus(s: unknown): ScriptStatus {
  return s === "live" || s === "archived" ? s : "draft";
}

// Returns the variant list for a format override, migrating a legacy single
// `script` string into one live variant. Never mutates the input.
export function normalizeVariants(ov: ScriptSource | undefined | null): ScriptVariant[] {
  if (!ov) return [];
  if (ov.scriptVariants && ov.scriptVariants.length > 0) {
    return ov.scriptVariants.map((v) => ({
      id: v.id || makeVariantId(),
      label: v.label?.trim() || "Untitled",
      body: v.body ?? "",
      status: coerceStatus(v.status),
    }));
  }
  const legacy = (ov.script ?? "").trim();
  if (legacy) {
    return [{ id: "legacy", label: "A", body: ov.script ?? "", status: "live" }];
  }
  return [];
}

export function liveVariants(variants: ScriptVariant[]): ScriptVariant[] {
  return variants.filter((v) => v.status === "live" && v.body.trim());
}

// The script string shown publicly. Picks the first live variant (deterministic
// so SSR is stable). When `seed` is given and multiple variants are live, it
// rotates among them — a hook for per-creator A/B once identity is available.
export function resolveLiveScript(
  variants: ScriptVariant[],
  seed?: number
): string | undefined {
  const live = liveVariants(variants);
  if (live.length === 0) return undefined;
  if (live.length === 1 || seed == null) return live[0].body.trim();
  const i = Math.abs(Math.floor(seed)) % live.length;
  return live[i].body.trim();
}

// Body to mirror back into the legacy `script` field on every edit.
export function firstLiveBody(variants: ScriptVariant[]): string | undefined {
  const live = liveVariants(variants);
  if (live.length === 0) return undefined;
  return live[0].body.trim() || undefined;
}
