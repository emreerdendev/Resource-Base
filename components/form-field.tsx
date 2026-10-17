import { cn } from "@/lib/utils";

/**
 * Label + control + hint/error, wired for screen readers through ids that
 * `fieldProps(id, error, hint)` puts on the control.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  counter,
  className,
  children,
}: {
  id: string;
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** e.g. "120/300" for capped text. */
  counter?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-sm font-medium">
          {label}
          {required && (
            <span aria-hidden className="text-destructive">
              *
            </span>
          )}
          {counter && (
            <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">{counter}</span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className={cn("mt-1 text-xs text-muted-foreground")}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
