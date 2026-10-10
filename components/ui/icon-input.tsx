import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Standard form input with a leading icon, sized to match the rest of the
 * profile/submit forms (h-9). Keeps every field a consistent height and look.
 */
export function IconInput({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  /** Lucide icon or any brand glyph component taking a className. */
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <input
        className={cn(
          "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}
