"use client";

import { useRef, useState, type ReactNode } from "react";
import type {
  Onboarding,
  OnboardingBlock,
  OnboardingStep,
  OnboardingQuestionType,
} from "@/lib/db";
import { PROSE_CLASS, isLikelyHtml, plainTextToHtml } from "@/components/RichText";

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
}: {
  value: Onboarding | null | undefined;
  onSave: (next: Onboarding) => void | Promise<void>;
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
}: {
  block: OnboardingBlock;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onChange: (b: OnboardingBlock) => void;
  onRemove: () => void;
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

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }
  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }
  function toggleHighlight() {
    ref.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 3 ? node.parentElement : (node as Element);
    const existing = el?.closest("mark");
    if (existing) {
      // Toggle off — unwrap the <mark>.
      const parent = existing.parentNode;
      if (parent) {
        while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
        parent.removeChild(existing);
      }
    } else {
      const mark = document.createElement("mark");
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }
    sel.removeAllRanges();
    emit();
  }
  function addLink() {
    const url = window.prompt("Link URL", "https://");
    if (url) exec("createLink", url);
  }

  const tools: { title: string; label: ReactNode; run: () => void }[] = [
    { title: "Heading", label: "H1", run: () => exec("formatBlock", "<h2>") },
    { title: "Subheading", label: "H2", run: () => exec("formatBlock", "<h3>") },
    { title: "Normal text", label: "¶", run: () => exec("formatBlock", "<p>") },
    { title: "Bold", label: <b>B</b>, run: () => exec("bold") },
    { title: "Italic", label: <i>I</i>, run: () => exec("italic") },
    {
      title: "Highlight",
      label: (
        <span className="bg-accent text-accent-ink px-0.5 rounded-[2px]">H</span>
      ),
      run: toggleHighlight,
    },
    { title: "Quote", label: "❝", run: () => exec("formatBlock", "<blockquote>") },
    { title: "Bullet list", label: "•", run: () => exec("insertUnorderedList") },
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
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="Write the copy… select text and tap B, highlight, etc."
        onInput={emit}
        onBlur={emit}
        dangerouslySetInnerHTML={{ __html: initial.current }}
        className={`${PROSE_CLASS} min-h-[110px] px-3 py-2.5 bg-background focus:outline-none text-sm [&_h2]:text-xl [&_h3]:text-base`}
      />
    </div>
  );
}
