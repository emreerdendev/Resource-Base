import type { LucideIcon } from "lucide-react";

/**
 * Title row shared by the account pages (applications, favorites,
 * submissions, notifications, settings): icon + title, an explanation of what
 * the page is for, and optional actions on the right.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <Icon className="size-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {actions && <div className="ml-auto flex gap-2">{actions}</div>}
      </div>
      {/* Kept narrower than the row so it never runs under the actions. */}
      <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">{description}</p>
    </div>
  );
}
