import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native <select> with our own chevron, so the arrow keeps the same padding
 * from the border in every browser (the built-in one hugs the edge).
 */
export function SortSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <select
        {...props}
        className="h-full min-h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-background py-1 pr-9 pl-3 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
