"use client";

// Extracted from OnboardingEditor so the overview (and anything else that
// needs prose with highlights) shares one editor rather than growing a second,
// subtly different one.

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  PROSE_CLASS,
  isLikelyHtml,
  plainTextToHtml,
} from "@/components/RichText";

// True WYSIWYG editor: a contentEditable surface styled exactly like the public
// render (PROSE_CLASS), so bold looks bold here too. Stores HTML. Uncontrolled
// (seeded once via a memoized initial) so the caret never jumps while typing.
export function RichTextArea({
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

