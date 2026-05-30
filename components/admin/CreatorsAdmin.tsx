"use client";

import { useState } from "react";

type Row = {
  id: string;
  name: string;
  email: string | null;
  status: "onboarded" | "approved";
  createdAt: string;
  answers: Record<string, unknown>;
};

function AnswerList({
  answers,
  labels,
}: {
  answers: Record<string, unknown>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(answers).filter(
    ([, v]) => v !== "" && v !== false && v != null
  );
  if (entries.length === 0) {
    return <p className="text-xs text-muted italic">No answers submitted.</p>;
  }
  return (
    <dl className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="text-sm">
          <dt className="text-[10px] uppercase tracking-widest font-bold text-muted">
            {labels[k] ?? k}
          </dt>
          <dd className="font-medium">
            {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CreatorCard({
  row,
  labels,
  onRemove,
}: {
  row: Row;
  labels: Record<string, string>;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-2 border-line bg-background rounded-md">
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="font-black text-sm truncate">{row.name}</div>
          <div className="text-[11px] text-muted truncate">
            {row.email ?? "no email"} ·{" "}
            {new Date(row.createdAt).toLocaleDateString()}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest"
        >
          {open ? "Hide" : "Answers"}
        </button>
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="border-2 border-line bg-background px-2 py-1 rounded-sm nb-press text-[10px] font-black uppercase tracking-widest text-[#b91c1c] hover:bg-[#fee2e2]"
        >
          {row.status === "approved" ? "Remove access" : "Remove"}
        </button>
      </div>
      {open && (
        <div className="border-t-2 border-line p-3 bg-paper">
          <AnswerList answers={row.answers} labels={labels} />
        </div>
      )}
    </div>
  );
}

export function CreatorsAdmin({
  briefSlug,
  initial,
  questionLabels,
}: {
  briefSlug: string;
  initial: Row[];
  questionLabels: Record<string, string>;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const approved = rows.filter((r) => r.status === "approved");
  const onboarded = rows.filter((r) => r.status !== "approved");

  async function remove(id: string) {
    const row = rows.find((r) => r.id === id);
    const msg =
      row?.status === "approved"
        ? "Remove this creator's access? They'll have to enter the code again to get back in."
        : "Remove this creator from the list?";
    if (!window.confirm(msg)) return;
    const res = await fetch(
      `/api/briefs/${encodeURIComponent(briefSlug)}/creators?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (res.ok) setRows((rs) => rs.filter((r) => r.id !== id));
    else alert("Couldn't remove — try again.");
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-widest">
          ✅ Approved — got in ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="text-xs text-muted italic">No one approved yet.</p>
        ) : (
          <div className="space-y-2">
            {approved.map((r) => (
              <CreatorCard
                key={r.id}
                row={r}
                labels={questionLabels}
                onRemove={remove}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-widest">
          ⏳ Finished onboarding — awaiting code ({onboarded.length})
        </h2>
        {onboarded.length === 0 ? (
          <p className="text-xs text-muted italic">None yet.</p>
        ) : (
          <div className="space-y-2">
            {onboarded.map((r) => (
              <CreatorCard
                key={r.id}
                row={r}
                labels={questionLabels}
                onRemove={remove}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
