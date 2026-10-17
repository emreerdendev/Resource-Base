"use client";

import { cn } from "@/lib/utils";

/**
 * A labelled group of toggle chips with result counts, shared by the company
 * and CV directories' filter panels. Options that would yield nothing are
 * disabled (unless already selected, so they can still be cleared).
 */
export function Facet({
  label,
  options,
  counts,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  /** Result count per option; options that would yield nothing are disabled. */
  counts?: Map<string, number>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          const count = counts?.get(o.value);
          const empty = count === 0 && !on;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              disabled={empty}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                on
                  ? "cursor-pointer border-primary bg-primary text-primary-foreground"
                  : empty
                    ? "cursor-not-allowed border-border bg-background opacity-45"
                    : "cursor-pointer border-border bg-background hover:bg-muted",
              )}
            >
              {o.label}
              {count !== undefined && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
