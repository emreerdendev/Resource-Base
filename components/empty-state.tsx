import type { LucideIcon } from "lucide-react";

/**
 * The shared empty / signed-out state of the personal lists (Favorites, My
 * Applications, Liked CVs): a dashed box with an icon, a line, an optional
 * hint and one action — so the three pages look and read the same.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center">
      <Icon className="mx-auto size-6 text-muted-foreground" />
      <p className="mt-3 text-muted-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
