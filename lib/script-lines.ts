// Script beat parsing + cue anchoring, shared by the public brief view and the
// admin studio.
//
// Scripts are written as plain text in this app's "00:03 line" convention.
// Parsing lives here (rather than inside Views.tsx, where it used to) so the
// admin shot-list editor anchors cues to exactly the same beats the creator
// page renders. If the two ever parsed differently, a cue attached in the admin
// would land on the wrong line — or vanish — on the public page.

import type { CueHow, ScriptCue } from "./types";

export type ScriptLine = { timestamp?: string; body: string };

export function parseScriptLines(text: string): ScriptLine[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];
  const byLine = trimmed
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byLine.length > 1) {
    const out: ScriptLine[] = [];
    for (let i = 0; i < byLine.length; i++) {
      const line = byLine[i];
      const m = line.match(/^(\d{1,2}:\d{2})\s*[:\-–]?\s*(.*)$/);
      if (!m) {
        out.push({ body: line });
        continue;
      }
      // A timestamp sitting alone on its own line belongs to the line under
      // it — that is how these scripts are actually written:
      //   00:03
      //   Show the app opening.
      // Without this the beat splits in two: a timestamp with no words, and
      // words with no timestamp. The public page then prints an empty row, and
      // every real line falls back to the fragile positional cue anchor.
      if (!m[2].trim()) {
        const next = byLine[i + 1];
        const nextIsTimestamp =
          next != null && /^(\d{1,2}:\d{2})\s*[:\-–]?\s*$/.test(next);
        if (next != null && !nextIsTimestamp) {
          out.push({ timestamp: m[1], body: next.replace(/^(\d{1,2}:\d{2})\s*[:\-–]?\s*/, "") });
          i++;
          continue;
        }
      }
      out.push({ timestamp: m[1], body: m[2] });
    }
    return out;
  }
  const re = /(\d{1,2}:\d{2})\s+/g;
  const parts: ScriptLine[] = [];
  let lastIndex = 0;
  let lastTs: string | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    const segment = trimmed.slice(lastIndex, m.index).trim();
    if (segment) parts.push({ timestamp: lastTs, body: segment });
    lastTs = m[1];
    lastIndex = m.index + m[0].length;
  }
  const tail = trimmed.slice(lastIndex).trim();
  if (tail) parts.push({ timestamp: lastTs, body: tail });
  return parts.length ? parts : [{ body: trimmed }];
}

// The anchor a cue stores. Timestamped beats key on the timestamp, so
// rewording or reordering lines keeps the cue on the right moment. Untimed
// beats have no such handle and fall back to position.
export function beatKey(line: ScriptLine, index: number): string {
  return line.timestamp ? line.timestamp : `#${index}`;
}

// Secondary anchor for untimed beats. Position alone is brittle: inserting a
// line above an untimed one shifts every index below it and would strand every
// cue pinned there. Snapshotting the line's text lets those cues follow the
// line instead. Normalized so trivial edits (casing, spacing, trailing period)
// do not break the match.
export function beatText(line: ScriptLine): string {
  return line.body
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ResolvedCues = {
  // Cue lists per beat index. Only beats with cues appear.
  byIndex: Map<number, ScriptCue[]>;
  // Cues whose beat is gone — the line was deleted, or both its timestamp and
  // its wording changed. Surfaced rather than dropped so a shot never goes
  // missing silently.
  orphans: ScriptCue[];
};

// Assign every cue to at most one beat, in a single pass over the script.
//
// Two-stage on purpose: exact anchors are matched first across the whole
// script, then the text fallback runs only for what is left over. Doing it
// per-beat instead would let a fallback match steal a cue that a later beat
// owns exactly. Each beat claims a given cue once, so duplicate lines in a
// script cannot render the same shot twice.
export function resolveCues(
  cues: ScriptCue[] | undefined,
  lines: ScriptLine[]
): ResolvedCues {
  const byIndex = new Map<number, ScriptCue[]>();
  if (!cues || cues.length === 0) return { byIndex, orphans: [] };

  const push = (i: number, c: ScriptCue) => {
    const list = byIndex.get(i);
    if (list) list.push(c);
    else byIndex.set(i, [c]);
  };

  const keyToIndex = new Map<string, number>();
  const textToIndex = new Map<string, number>();
  lines.forEach((l, i) => {
    const k = beatKey(l, i);
    if (!keyToIndex.has(k)) keyToIndex.set(k, i);
    const txt = beatText(l);
    // First occurrence wins, so a repeated line does not claim cues twice.
    if (txt && !textToIndex.has(txt)) textToIndex.set(txt, i);
  });

  const leftover: ScriptCue[] = [];
  for (const c of cues) {
    const i = keyToIndex.get(c.at);
    if (i != null) push(i, c);
    else leftover.push(c);
  }

  const orphans: ScriptCue[] = [];
  for (const c of leftover) {
    const i = c.atText ? textToIndex.get(c.atText) : undefined;
    if (i != null) push(i, c);
    else orphans.push(c);
  }

  return { byIndex, orphans };
}

export function makeCueId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function newCue(
  line: ScriptLine,
  index: number,
  how: CueHow = "broll"
): ScriptCue {
  return {
    id: makeCueId(),
    at: beatKey(line, index),
    // Only untimed beats need the text fallback; a timestamp is already stable.
    atText: line.timestamp ? undefined : beatText(line) || undefined,
    how,
  };
}

// Re-anchor an existing cue onto a different beat (used by the admin's re-pin
// dropdown). Keeps the fallback in sync with the new target.
export function repinCue(
  cue: ScriptCue,
  line: ScriptLine,
  index: number
): ScriptCue {
  return {
    ...cue,
    at: beatKey(line, index),
    atText: line.timestamp ? undefined : beatText(line) || undefined,
  };
}

// "3s" / "1.5s" / "" — kept short because it renders inside a chip.
export function formatDuration(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "";
  return Number.isInteger(sec) ? `${sec}s` : `${sec.toFixed(1)}s`;
}

// Total on-screen seconds a script's cues account for. Shown in the admin as a
// sanity check against the script's own runtime.
export function totalCueSeconds(cues: ScriptCue[] | undefined): number {
  return (cues ?? []).reduce((n, c) => n + (c.durationSec ?? 0), 0);
}
