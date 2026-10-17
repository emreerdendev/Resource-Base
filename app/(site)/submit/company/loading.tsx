import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors SubmitForm: title + subtitle, labelled fields, a wide submit button. */
export default function Loading() {
  // [label width, control height] for each field, matching the real form
  // (name, url, category select, note textarea, email).
  const fields: [string, string][] = [
    ["w-20", "h-9"],
    ["w-16", "h-9"],
    ["w-24", "h-9"],
    ["w-16", "h-20"],
    ["w-14", "h-9"],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-4">
        {fields.map(([labelW, controlH], i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className={`h-4 ${labelW}`} />
            <Skeleton className={`w-full rounded-md ${controlH}`} />
          </div>
        ))}
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}
