"use client";

import { useCallback, useState } from "react";

/**
 * Inline form validation without a form library. Each form derives its errors
 * from the same validators the API uses (lib/*-input.ts), and this hook only
 * decides *when* to show them: after a field is left, or for every field once
 * submit is pressed — then focus jumps to the first invalid control. Forms set
 * `noValidate`, so the browser's own popups never appear.
 */
export function useFormErrors<K extends string>(errors: Partial<Record<K, string | null>>) {
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const touch = useCallback((key: K) => setTouched((s) => ({ ...s, [key]: true })), []);

  /** The error to display for `key`, or null while it shouldn't show yet. */
  const show = (key: K): string | null => ((submitted || touched[key]) && errors[key]) || null;

  const valid = Object.values(errors).every((e) => !e);

  /** Call from onSubmit: reveals all errors and focuses the first, or returns true. */
  const check = (form: HTMLFormElement | null): boolean => {
    setSubmitted(true);
    if (valid) return true;
    // After React paints the error states.
    requestAnimationFrame(() =>
      form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
    return false;
  };

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
  }, []);

  return { show, touch, check, valid, reset };
}

/** aria wiring for a control inside <FormField id=…>. */
export function fieldProps(id: string, error: string | null, hint?: boolean) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ");
  return {
    id,
    "aria-invalid": Boolean(error),
    ...(describedBy && { "aria-describedby": describedBy }),
  };
}
