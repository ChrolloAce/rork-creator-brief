"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import type {
  Onboarding,
  OnboardingBlock,
  OnboardingStep,
  OnboardingQuestionType,
  OnboardingReview,
} from "@/lib/db";
import { PROSE_CLASS, isLikelyHtml, plainTextToHtml } from "@/components/RichText";
import { VideoPicker } from "@/components/admin/VideoPicker";
import { VideoChip } from "@/components/admin/VideoChip";
import type { VideoExample } from "@/lib/types";

function genId(): string {
  return `ob_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const EMPTY: Onboarding = { enabled: false, steps: [] };

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.url) throw new Error(j.error ?? `HTTP ${res.status}`);
  return j.url as string;
}

const QUESTION_TYPES: { value: OnboardingQuestionType; label: string }[] = [
  { value: "short", label: "Short text" },
  { value: "long", label: "Long text" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

export function OnboardingEditor({
  value,
  onSave,
  scopedProjectIds,
}: {
  value: Onboarding | null | undefined;
  onSave: (next: Onboarding) => void | Promise<void>;
  scopedProjectIds?: string[];
}) {
  const [ob, setOb] = useState<Onboarding>(value ?? EMPTY);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave so typing doesn't fire a request per keystroke.
  function commit(next: Onboarding) {
    setOb(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void onSave(next), 700);
  }

  const steps = ob.steps;

  function setSteps(next: OnboardingStep[]) {
    commit({ ...ob, steps: next });
  }
  function addStep() {
    setSteps([
      ...steps,
      { id: genId(), title: `Step ${steps.length + 1}`, subtitle: "", blocks: [] },
    ]);
  }
  function patchStep(id: string, patch: Partial<OnboardingStep>) {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeStep(id: string) {
    setSteps(steps.filter((s) => s.id !== id));
  }
  function moveStep(idx: number, dir: -1 | 1) {
    const t = idx + dir;
    if (t < 0 || t >= steps.length) return;
    const next = [...steps];
    [next[idx], next[t]] = [next[t], next[idx]];
    setSteps(next);
  }
  function duplicateStep(idx: number) {
    const src = steps[idx];
    const copy: OnboardingStep = {
      ...src,
      id: genId(),
      blocks: src.blocks.map((b) => ({ ...b, id: genId() })),
    };
    setSteps([...steps.slice(0, idx + 1), copy, ...steps.slice(idx + 1)]);
  }

  function setBlocks(stepId: string, blocks: OnboardingBlock[]) {
    patchStep(stepId, { blocks });
  }
  function addBlock(step: OnboardingStep, block: OnboardingBlock) {
    setBlocks(step.id, [...step.blocks, block]);
  }

  const totalBlocks = steps.reduce((n, s) => n + s.blocks.length, 0);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => commit({ ...ob, enabled: !ob.enabled })}
        className={`w-full flex items-center justify-between gap-3 border-2 border-line rounded-md px-3 py-2.5 nb-press ${
          ob.enabled ? "bg-accent text-accent-ink" : "bg-background"
        }`}
      >
        <span className="text-sm font-black uppercase tracking-widest">
          {ob.enabled ? "● Onboarding ON" : "○ Off — tap to enable"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
          {steps.length} steps · {totalBlocks} blocks
        </span>
      </button>

      <p className="text-[10px] text-muted leading-relaxed">
        Build the step-by-step intro creators walk through. Each step is a page;
        add text, images, video embeds, and questions. Drag order with the
        arrows. Changes autosave.
      </p>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="border-2 border-line bg-paper rounded-md overflow-hidden"
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-ink text-background">
              <span className="text-[11px] font-black uppercase tracking-widest">
                Step {idx + 1}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveStep(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Move step up"
                  className="w-6 h-6 border-2 border-background/40 rounded-sm font-black nb-press disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(idx, 1)}
                  disabled={idx === steps.length - 1}
                  aria-label="Move step down"
                  className="w-6 h-6 border-2 border-background/40 rounded-sm font-black nb-press disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => duplicateStep(idx)}
                  aria-label="Duplicate step"
                  title="Duplicate step"
                  className="w-6 h-6 border-2 border-background/40 rounded-sm font-black nb-press"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(step.id)}
                  aria-label="Remove step"
                  className="w-6 h-6 border-2 border-background/40 rounded-sm font-black nb-press"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-2.5 space-y-2">
              <input
                type="text"
                value={step.title ?? ""}
                onChange={(e) => patchStep(step.id, { title: e.target.value })}
                placeholder="Step headline (e.g. Welcome to the campaign)"
                className="w-full border-2 border-line rounded-md px-2 py-1.5 font-black focus:outline-none focus:border-accent bg-background"
              />
              <input
                type="text"
                value={step.subtitle ?? ""}
                onChange={(e) => patchStep(step.id, { subtitle: e.target.value })}
                placeholder="Subtitle (optional)"
                className="w-full border-2 border-line rounded-md px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
              />

              {step.blocks.map((block, bIdx) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  canUp={bIdx > 0}
                  canDown={bIdx < step.blocks.length - 1}
                  onMove={(dir) => {
                    const t = bIdx + dir;
                    if (t < 0 || t >= step.blocks.length) return;
                    const next = [...step.blocks];
                    [next[bIdx], next[t]] = [next[t], next[bIdx]];
                    setBlocks(step.id, next);
                  }}
                  onChange={(nb) =>
                    setBlocks(
                      step.id,
                      step.blocks.map((b) => (b.id === block.id ? nb : b))
                    )
                  }
                  onRemove={() =>
                    setBlocks(
                      step.id,
                      step.blocks.filter((b) => b.id !== block.id)
                    )
                  }
                  scopedProjectIds={scopedProjectIds}
                />
              ))}

              <div className="flex flex-wrap gap-1.5 pt-1">
                <AddBlockButton
                  label="+ Text"
                  onClick={() => addBlock(step, { kind: "text", id: genId(), text: "" })}
                />
                <AddBlockButton
                  label="+ Image"
                  onClick={() => addBlock(step, { kind: "image", id: genId(), url: "" })}
                />
                <AddBlockButton
                  label="+ Video"
                  onClick={() => addBlock(step, { kind: "video", id: genId(), url: "" })}
                />
                <AddBlockButton
                  label="+ Examples"
                  onClick={() =>
                    addBlock(step, { kind: "videos", id: genId(), videos: [] })
                  }
                />
                <AddBlockButton
                  label="+ Reviews"
                  onClick={() =>
                    addBlock(step, { kind: "reviews", id: genId(), reviews: [] })
                  }
                />
                <AddBlockButton
                  label="+ Question"
                  onClick={() =>
                    addBlock(step, {
                      kind: "question",
                      id: genId(),
                      label: "",
                      field: "short",
                    })
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addStep}
        className="w-full border-2 border-line bg-ink text-background rounded-md px-2 py-2 text-xs font-black uppercase tracking-widest nb-press"
      >
        + Add step
      </button>
    </div>
  );
}

function AddBlockButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-2 border-dashed border-line bg-background rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent hover:border-accent"
    >
      {label}
    </button>
  );
}

function BlockEditor({
  block,
  canUp,
  canDown,
  onMove,
  onChange,
  onRemove,
  scopedProjectIds,
}: {
  block: OnboardingBlock;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onChange: (b: OnboardingBlock) => void;
  onRemove: () => void;
  scopedProjectIds?: string[];
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const kindLabel =
    block.kind === "text"
      ? "Text"
      : block.kind === "image"
        ? "Image"
        : block.kind === "video"
          ? "Video"
          : block.kind === "videos"
            ? "Example videos"
            : block.kind === "reviews"
              ? "App Store reviews"
              : "Question";

  return (
    <div className="border-2 border-line bg-background rounded-md p-2 flex gap-2">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-muted">
          {kindLabel}
        </div>

        {block.kind === "text" && (
          <RichTextArea
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
          />
        )}

        {block.kind === "image" && (
          <div className="space-y-1.5">
            {block.url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={block.url}
                alt=""
                className="w-full max-h-48 object-contain border-2 border-line rounded-sm bg-paper"
              />
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setBusy(true);
                try {
                  const url = await uploadImage(f);
                  onChange({ ...block, url });
                } catch (err) {
                  alert((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="border-2 border-line bg-background rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-40"
              >
                {busy ? "Uploading…" : block.url ? "Replace image" : "Upload image"}
              </button>
            </div>
            <input
              type="text"
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              placeholder="Caption (optional)"
              className="w-full border-2 border-line rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-accent bg-background"
            />
          </div>
        )}

        {block.kind === "video" && (
          <div className="space-y-1.5">
            <input
              type="text"
              value={block.url}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              placeholder="Video URL (TikTok / YouTube / .mp4)"
              className="w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-mono focus:outline-none focus:border-accent bg-background"
            />
            <input
              type="text"
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              placeholder="Caption (optional)"
              className="w-full border-2 border-line rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-accent bg-background"
            />
          </div>
        )}

        {block.kind === "videos" && (
          <VideosBlock
            block={block}
            onChange={onChange}
            scopedProjectIds={scopedProjectIds}
          />
        )}

        {block.kind === "reviews" && (
          <ReviewsBlock block={block} onChange={onChange} />
        )}

        {block.kind === "question" && (
          <div className="space-y-1.5">
            <input
              type="text"
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              placeholder="Question (e.g. What's your TikTok handle?)"
              className="w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={block.field}
                onChange={(e) =>
                  onChange({ ...block, field: e.target.value as OnboardingQuestionType })
                }
                className="border-2 border-line rounded-sm px-2 py-1 text-xs font-bold bg-background focus:outline-none focus:border-accent"
              >
                {QUESTION_TYPES.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!block.required}
                  onChange={(e) => onChange({ ...block, required: e.target.checked })}
                />
                Required
              </label>
            </div>
            {block.field === "select" && (
              <input
                type="text"
                value={(block.options ?? []).join(", ")}
                onChange={(e) =>
                  onChange({
                    ...block,
                    options: e.target.value
                      .split(",")
                      .map((o) => o.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Options, comma separated (e.g. TikTok, Instagram, YouTube)"
                className="w-full border-2 border-line rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-accent bg-background"
              />
            )}
            {(block.field === "short" || block.field === "long") && (
              <input
                type="text"
                value={block.placeholder ?? ""}
                onChange={(e) => onChange({ ...block, placeholder: e.target.value })}
                placeholder="Placeholder (optional)"
                className="w-full border-2 border-line rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-accent bg-background"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="button"
          aria-label="Move up"
          disabled={!canUp}
          onClick={() => onMove(-1)}
          className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={!canDown}
          onClick={() => onMove(1)}
          className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          aria-label="Remove block"
          onClick={onRemove}
          className="w-7 h-7 border-2 border-line bg-background rounded-sm font-black nb-press"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// True WYSIWYG editor: a contentEditable surface styled exactly like the public
// render (PROSE_CLASS), so bold looks bold here too. Stores HTML. Uncontrolled
// (seeded once via a memoized initial) so the caret never jumps while typing.
function RichTextArea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Seed once. Plain-text legacy content is converted so line breaks survive.
  const initial = useRef(isLikelyHtml(value) ? value : plainTextToHtml(value));
  // Last selection inside the editor — clicking a toolbar button can blur it,
  // so we remember the range and restore it before applying formatting.
  const saved = useRef<Range | null>(null);
  // Keep the latest onChange in a ref so the memoized (never-rerendering)
  // Editable can always reach the current handler without re-rendering.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function emit() {
    if (ref.current) onChangeRef.current(ref.current.innerHTML);
  }
  function remember() {
    const sel = window.getSelection();
    if (
      sel &&
      sel.rangeCount > 0 &&
      ref.current &&
      ref.current.contains(sel.anchorNode)
    ) {
      saved.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function activeRange(): Range | null {
    const sel = window.getSelection();
    if (!sel) return null;
    if (
      saved.current &&
      ref.current &&
      ref.current.contains(saved.current.commonAncestorContainer)
    ) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
      return saved.current;
    }
    return sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  }

  // Deterministic inline formatting — wrap the selection in a real tag (or
  // unwrap it to toggle off). Does NOT rely on the flaky execCommand.
  function wrapInline(tag: "strong" | "em" | "mark") {
    ref.current?.focus();
    const range = activeRange();
    if (!range || range.collapsed) return;
    const container = range.commonAncestorContainer;
    const el =
      container.nodeType === 3
        ? container.parentElement
        : (container as Element);
    const existing = el?.closest(tag);
    if (existing && ref.current?.contains(existing)) {
      const parent = existing.parentNode;
      if (parent) {
        while (existing.firstChild)
          parent.insertBefore(existing.firstChild, existing);
        parent.removeChild(existing);
      }
    } else {
      const wrapper = document.createElement(tag);
      try {
        wrapper.appendChild(range.extractContents());
        range.insertNode(wrapper);
      } catch {
        return;
      }
    }
    window.getSelection()?.removeAllRanges();
    saved.current = null;
    ref.current?.normalize();
    emit();
  }

  // Block-level formatting — turn the current line/paragraph into a heading,
  // quote, list, or plain paragraph by re-parenting its block.
  function setBlock(tag: "h2" | "h3" | "p" | "blockquote" | "ul") {
    ref.current?.focus();
    const range = activeRange();
    const root = ref.current;
    if (!range || !root) return;
    // Find the top-level child of the editor that contains the caret.
    let node: Node | null = range.startContainer;
    while (node && node.parentNode !== root) node = node.parentNode;
    const lineEls: Element[] = [];
    if (node && node.nodeType === 1) lineEls.push(node as Element);
    // Build the replacement.
    const makeEl = (html: string) => {
      if (tag === "ul") {
        const ul = document.createElement("ul");
        const li = document.createElement("li");
        li.innerHTML = html || "<br>";
        ul.appendChild(li);
        return ul;
      }
      const el = document.createElement(tag);
      el.innerHTML = html || "<br>";
      return el;
    };
    if (lineEls.length === 0) {
      // No block wrapper (bare text node at root) — wrap everything selected.
      const el = makeEl(root.innerHTML);
      root.innerHTML = "";
      root.appendChild(el);
    } else {
      for (const line of lineEls) {
        const el = makeEl(line.innerHTML);
        line.replaceWith(el);
      }
    }
    saved.current = null;
    emit();
  }

  function addLink() {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    ref.current?.focus();
    const range = activeRange();
    if (!range || range.collapsed) return;
    const a = document.createElement("a");
    a.href = url;
    try {
      a.appendChild(range.extractContents());
      range.insertNode(a);
    } catch {
      return;
    }
    saved.current = null;
    emit();
  }

  const tools: { title: string; label: ReactNode; run: () => void }[] = [
    { title: "Heading", label: "H1", run: () => setBlock("h2") },
    { title: "Subheading", label: "H2", run: () => setBlock("h3") },
    { title: "Normal text", label: "¶", run: () => setBlock("p") },
    { title: "Bold", label: <b>B</b>, run: () => wrapInline("strong") },
    { title: "Italic", label: <i>I</i>, run: () => wrapInline("em") },
    {
      title: "Highlight",
      label: (
        <span className="bg-accent text-accent-ink px-0.5 rounded-[2px]">H</span>
      ),
      run: () => wrapInline("mark"),
    },
    { title: "Quote", label: "❝", run: () => setBlock("blockquote") },
    { title: "Bullet list", label: "•", run: () => setBlock("ul") },
    { title: "Link", label: "🔗", run: addLink },
  ];

  return (
    <div className="border-2 border-line rounded-md bg-paper overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 px-1.5 py-1 border-b-2 border-line bg-background">
        {tools.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
            className="min-w-7 h-7 px-1.5 border-2 border-line bg-background rounded-sm text-xs font-black nb-press flex items-center justify-center"
          >
            {t.label}
          </button>
        ))}
      </div>
      <Editable
        editorRef={ref}
        initialHtml={initial.current}
        onInput={emit}
        onKeyUp={remember}
        onMouseUp={remember}
        onBlur={() => {
          remember();
          emit();
        }}
        className={`${PROSE_CLASS} min-h-[110px] px-3 py-2.5 bg-background focus:outline-none text-sm [&_h2]:text-xl [&_h3]:text-base`}
      />
    </div>
  );
}

// The contentEditable surface, isolated and memoized so it NEVER re-renders
// after mount. That's what stops React from resetting the caret to the start
// when the parent re-renders (e.g. on autosave). HTML is set once imperatively;
// all handlers read live DOM / refs so the captured first instances stay valid.
type EditableProps = {
  editorRef: { current: HTMLDivElement | null };
  initialHtml: string;
  onInput: () => void;
  onKeyUp: () => void;
  onMouseUp: () => void;
  onBlur: () => void;
  className: string;
};
const Editable = memo(
  function Editable({
    editorRef,
    initialHtml,
    onInput,
    onKeyUp,
    onMouseUp,
    onBlur,
    className,
  }: EditableProps) {
    useEffect(() => {
      if (editorRef.current) editorRef.current.innerHTML = initialHtml;
      // run once on mount only
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="Write the copy… select text and tap B, highlight, etc."
        onInput={onInput}
        onKeyUp={onKeyUp}
        onMouseUp={onMouseUp}
        onBlur={onBlur}
        className={className}
      />
    );
  },
  () => true // props are stable refs/first-captured handlers — never re-render
);

// ----- ViewTrack example videos block -----
function VideosBlock({
  block,
  onChange,
  scopedProjectIds,
}: {
  block: Extract<OnboardingBlock, { kind: "videos" }>;
  onChange: (b: OnboardingBlock) => void;
  scopedProjectIds?: string[];
}) {
  const keyOf = (v: VideoExample) => v.dbId ?? v.id;
  const ids = new Set<string>();
  for (const v of block.videos) ids.add(keyOf(v));

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={block.heading ?? ""}
        onChange={(e) => onChange({ ...block, heading: e.target.value })}
        placeholder="Heading (optional, e.g. Viral examples)"
        className="w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-bold focus:outline-none focus:border-accent bg-background"
      />
      {block.videos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {block.videos.map((v) => (
            <VideoChip
              key={keyOf(v)}
              video={v}
              fallbackId={keyOf(v)}
              onRemove={() =>
                onChange({
                  ...block,
                  videos: block.videos.filter((x) => keyOf(x) !== keyOf(v)),
                })
              }
            />
          ))}
        </div>
      )}
      <VideoPicker
        excludedIds={ids}
        scopedProjectIds={scopedProjectIds}
        onPick={(v) => {
          if (ids.has(keyOf(v))) return;
          onChange({ ...block, videos: [...block.videos, v] });
        }}
        placeholder="Search ViewTrack videos…"
      />
    </div>
  );
}

// ----- App Store reviews block (iTunes API) -----
type AppResult = {
  id: string;
  name: string;
  developer: string;
  icon: string;
  rating: number;
  ratingCount: number;
};

function ReviewsBlock({
  block,
  onChange,
}: {
  block: Extract<OnboardingBlock, { kind: "reviews" }>;
  onChange: (b: OnboardingBlock) => void;
}) {
  const [term, setTerm] = useState(block.appName ?? block.appId ?? "");
  const [country, setCountry] = useState(block.country ?? "us");
  const [apps, setApps] = useState<AppResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [fetched, setFetched] = useState<OnboardingReview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadReviews(id: string, name?: string) {
    setLoading(true);
    setErr(null);
    setApps(null);
    try {
      const res = await fetch(
        `/api/itunes-reviews?id=${encodeURIComponent(id)}&country=${encodeURIComponent(country)}`
      );
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Failed to load reviews");
      setFetched(j.reviews as OnboardingReview[]);
      onChange({ ...block, appId: id, appName: name ?? j.appName, country });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function search() {
    const t = term.trim();
    if (!t) return;
    setErr(null);
    // Pasted an App Store ID or URL? Load it directly.
    const idm = t.match(/^\d{4,}$/) ?? t.match(/id(\d{4,})/);
    if (idm) {
      await loadReviews(idm[1] ?? idm[0]);
      return;
    }
    setSearching(true);
    setApps(null);
    try {
      const res = await fetch(
        `/api/itunes-search?term=${encodeURIComponent(t)}&country=${encodeURIComponent(country)}`
      );
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Search failed");
      setApps(j.apps as AppResult[]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  const same = (a: OnboardingReview, b: OnboardingReview) =>
    a.author === b.author && a.body === b.body;
  const isSelected = (r: OnboardingReview) => block.reviews.some((x) => same(x, r));
  function toggle(r: OnboardingReview) {
    onChange({
      ...block,
      reviews: isSelected(r)
        ? block.reviews.filter((x) => !same(x, r))
        : [...block.reviews, r],
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-end">
        <label className="block flex-1 min-w-[160px]">
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
            Search the App Store by name
          </span>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder="e.g. Prayer Lock"
            className="mt-1 w-full border-2 border-line rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <label className="block w-16">
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
            Country
          </span>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="us"
            className="mt-1 w-full border-2 border-line rounded-sm px-2 py-1 text-sm font-mono focus:outline-none focus:border-accent bg-background"
          />
        </label>
        <button
          type="button"
          onClick={() => void search()}
          disabled={searching || loading || !term.trim()}
          className="border-2 border-line bg-ink text-background rounded-sm px-3 py-1.5 text-[10px] font-black uppercase tracking-widest nb-press disabled:opacity-40"
        >
          {searching ? "Searching…" : loading ? "Loading…" : "Search"}
        </button>
      </div>

      {(block.appName || block.reviews.length > 0) && (
        <div className="text-xs font-bold">
          {block.appName ? `${block.appName} · ` : ""}
          {block.reviews.length} selected
        </div>
      )}
      {err && (
        <p className="text-xs font-bold text-[#b91c1c] border-2 border-line bg-background px-2 py-1 rounded-sm">
          {err}
        </p>
      )}

      {apps && (
        <div className="space-y-1 max-h-60 overflow-y-auto border-2 border-line rounded-md p-2 bg-paper">
          {apps.length === 0 ? (
            <p className="text-xs text-muted italic">No apps found — try another name.</p>
          ) : (
            apps.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => loadReviews(a.id, a.name)}
                className="w-full flex items-center gap-2 text-left border-2 border-line bg-background rounded-sm p-1.5 nb-press"
              >
                {a.icon && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={a.icon}
                    alt=""
                    className="w-9 h-9 rounded-md border-2 border-line shrink-0"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-xs truncate">{a.name}</span>
                  <span className="block text-[10px] text-muted truncate">
                    {a.developer}
                    {a.ratingCount
                      ? ` · ${a.ratingCount.toLocaleString()} ratings`
                      : ""}
                  </span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest shrink-0">
                  Use →
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {fetched && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto border-2 border-line rounded-md p-2 bg-paper">
          {fetched.length === 0 ? (
            <p className="text-xs text-muted italic">No reviews returned for that app.</p>
          ) : (
            fetched.map((r, i) => {
              const sel = isSelected(r);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(r)}
                  className={`w-full text-left border-2 rounded-sm p-2 nb-press ${
                    sel ? "border-accent bg-accent/10" : "border-line bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-accent text-xs">{"★".repeat(r.rating)}</span>
                    <span className="text-[11px] font-black">{sel ? "✓ Added" : "Add"}</span>
                  </div>
                  {r.title && <div className="font-bold text-xs mt-0.5">{r.title}</div>}
                  <div className="text-xs text-ink line-clamp-3 leading-relaxed">{r.body}</div>
                  <div className="text-[10px] text-muted mt-0.5">— {r.author}</div>
                </button>
              );
            })
          )}
        </div>
      )}
      <p className="text-[10px] text-muted">
        Type your app&rsquo;s name and hit Search, pick it, then choose which
        reviews to show. (You can also paste an App Store ID or link.) Selected
        reviews are saved and shown to creators in the onboarding.
      </p>
    </div>
  );
}
