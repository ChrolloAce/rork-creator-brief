"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notify() {
  for (const cb of listeners) cb();
}

function readOpen(storageKey: string, defaultOpen: boolean): boolean {
  try {
    const v = localStorage.getItem(storageKey);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {}
  return defaultOpen;
}

export function CollapsibleCard({
  storageKey,
  title,
  meta,
  action,
  defaultOpen = false,
  children,
}: {
  storageKey: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const open = useSyncExternalStore(
    subscribe,
    () => readOpen(storageKey, defaultOpen),
    () => defaultOpen
  );

  const toggle = useCallback(() => {
    try {
      localStorage.setItem(storageKey, open ? "0" : "1");
    } catch {}
    notify();
  }, [open, storageKey]);

  return (
    <section className="border-2 border-line bg-background rounded-md nb-shadow-sm overflow-hidden">
      <div className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-paper">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex-1 flex items-baseline gap-2 flex-wrap min-w-0 text-left"
        >
          <span className="text-sm font-black uppercase tracking-widest truncate">
            {title}
          </span>
          {meta && (
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted">
              {meta}
            </span>
          )}
        </button>
        {action && (
          <div onClick={(e) => e.stopPropagation()}>{action}</div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? "Collapse" : "Expand"}
          className={`font-black text-base leading-none transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </button>
      </div>
      {open && (
        <div className="border-t-2 border-line p-4 sm:p-5">{children}</div>
      )}
    </section>
  );
}
