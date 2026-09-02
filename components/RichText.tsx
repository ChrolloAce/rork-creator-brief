import React from "react";

// Shared prose styling — applied to BOTH the WYSIWYG editor surface and the
// public render so what you type is exactly what creators see. Child-element
// selectors keep it neobrutalist: big black headings, orange highlight marks,
// accent-barred quotes, diamond-free disc lists.
export const PROSE_CLASS =
  "text-base sm:text-lg leading-relaxed text-ink space-y-4 " +
  "[&_h1]:text-3xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:leading-tight " +
  "[&_h2]:text-2xl [&_h2]:sm:text-3xl [&_h2]:font-black [&_h2]:tracking-tight " +
  "[&_h3]:text-xl [&_h3]:sm:text-2xl [&_h3]:font-black " +
  "[&_strong]:font-black [&_b]:font-black [&_em]:italic " +
  "[&_a]:font-bold [&_a]:underline [&_a]:decoration-2 [&_a]:decoration-accent [&_a]:underline-offset-2 " +
  "[&_mark]:bg-accent [&_mark]:text-accent-ink [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded-[3px] [&_mark]:font-bold [&_mark]:box-decoration-clone " +
  "[&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-paper [&_blockquote]:rounded-r-md [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:py-3 [&_blockquote]:text-lg [&_blockquote]:sm:text-xl [&_blockquote]:font-bold " +
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1";

export function isLikelyHtml(s: string): boolean {
  return /<\/?(p|h1|h2|h3|ul|ol|li|blockquote|strong|em|mark|b|i|u|a|br|div|span)\b/i.test(
    s
  );
}

// Plain text → safe HTML (escape + newlines to <br>), used to seed the editor
// from older plain-text content without losing line breaks.
export function plainTextToHtml(v: string): string {
  const esc = v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/\r?\n/g, "<br>");
}

export function RichText({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const value = html ?? "";
  // Older content was stored as plain text — render it preserving line breaks
  // rather than collapsing whitespace like HTML would.
  if (!isLikelyHtml(value)) {
    return (
      <div className={`${PROSE_CLASS} ${className ?? ""}`}>
        <p className="whitespace-pre-line">{value}</p>
      </div>
    );
  }
  return (
    <div
      className={`${PROSE_CLASS} ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

// Inline-only styling, for places that render a single line rather than a
// document: list items, rule text. Same look as PROSE_CLASS for the tags that
// can appear inline.
export const INLINE_PROSE_CLASS =
  "[&_strong]:font-black [&_b]:font-black [&_em]:italic " +
  "[&_mark]:bg-accent [&_mark]:text-accent-ink [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded-[3px] [&_mark]:font-bold [&_mark]:box-decoration-clone";

// Lightweight inline markup for line-based fields (rules, value props) where a
// WYSIWYG box per line would be unusable to type into:
//   ==text==  highlight     **text**  bold
// The input is escaped BEFORE the markers are expanded, so brief content can
// never inject its own HTML.
export function inlineMarkupToHtml(v: string): string {
  const esc = (v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/==([^=]+)==/g, "<mark>$1</mark>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

// Renders one line of text with the inline markers above applied.
export function InlineRich({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={`${INLINE_PROSE_CLASS} ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: inlineMarkupToHtml(text) }}
    />
  );
}
