import React from "react";

// Lightweight markdown-ish renderer — no dependency. Supports:
//   # Heading        ## Subheading
//   > Quote (consecutive lines merge)
//   - List item      (consecutive lines merge)
//   **bold**   *italic*   ==highlight==   [link](url)
// Everything renders as styled React nodes (no dangerouslySetInnerHTML).

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re =
    /(\*\*([^*]+)\*\*)|(==([^=]+)==)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) {
      nodes.push(
        <strong key={key} className="font-black">
          {m[2]}
        </strong>
      );
    } else if (m[3]) {
      nodes.push(
        <mark
          key={key}
          className="bg-accent text-accent-ink px-1 py-0.5 rounded-[3px] box-decoration-clone font-bold"
        >
          {m[4]}
        </mark>
      );
    } else if (m[5]) {
      nodes.push(
        <em key={key} className="italic">
          {m[6]}
        </em>
      );
    } else if (m[7]) {
      nodes.push(
        <a
          key={key}
          href={m[9]}
          target="_blank"
          rel="noreferrer"
          className="font-bold underline decoration-2 decoration-accent underline-offset-2"
        >
          {m[8]}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = (text ?? "").split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (!para.length) return;
    const k = `p-${key++}`;
    out.push(
      <p key={k} className="text-base sm:text-lg text-ink leading-relaxed">
        {para.map((l, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {renderInline(l, `${k}-${i}`)}
          </React.Fragment>
        ))}
      </p>
    );
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const k = `ul-${key++}`;
    out.push(
      <ul key={k} className="space-y-1.5 pl-1">
        {list.map((l, i) => (
          <li key={i} className="flex gap-2.5 text-base sm:text-lg text-ink leading-relaxed">
            <span className="text-accent font-black shrink-0 mt-0.5" aria-hidden>
              ◆
            </span>
            <span>{renderInline(l, `${k}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const k = `q-${key++}`;
    out.push(
      <blockquote
        key={k}
        className="border-l-4 border-accent bg-paper rounded-r-md pl-4 pr-3 py-3 text-lg sm:text-xl font-bold text-ink leading-relaxed"
      >
        {quote.map((l, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {renderInline(l, `${k}-${i}`)}
          </React.Fragment>
        ))}
      </blockquote>
    );
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushAll();
      continue;
    }
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const q = line.match(/^>\s?(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h2) {
      flushAll();
      const k = `h3-${key++}`;
      out.push(
        <h3 key={k} className="text-xl sm:text-2xl font-black tracking-tight mt-2">
          {renderInline(h2[1], k)}
        </h3>
      );
    } else if (h1) {
      flushAll();
      const k = `h2-${key++}`;
      out.push(
        <h2 key={k} className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mt-2">
          {renderInline(h1[1], k)}
        </h2>
      );
    } else if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
    } else if (li) {
      flushPara();
      flushQuote();
      list.push(li[1]);
    } else {
      flushList();
      flushQuote();
      para.push(line);
    }
  }
  flushAll();

  return <div className={`space-y-4 ${className ?? ""}`}>{out}</div>;
}
