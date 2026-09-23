// The contract shared by Server Actions and forms (mirrors Fragua's lib/form.ts).
//
// One Zod schema per form, used by BOTH sides: the client validates before
// sending to show errors next to each field, and the action validates again
// because Server Actions are public POST endpoints.
//
// Schema messages are message KEYS (e.g. "invalidEmail"), not text: the form
// translates them, so all UI copy stays in messages/.

import type { ZodError, ZodType } from "zod";

/** One message key per field, plus a general one for what belongs to no field. */
export type FieldErrors = Record<string, string>;

export type ActionResult = { ok?: boolean; error?: string; fieldErrors?: FieldErrors } | undefined;

/** Flattens Zod issues to the FIRST problem per top-level field. */
export function toFieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || field in errors) continue;
    errors[field] = issue.message;
  }
  return errors;
}

type Parsed<T> = { ok: true; data: T } | { ok: false; result: ActionResult };

/** Validates input and, on failure, builds the ActionResult to return as-is. */
export function parse<T>(schema: ZodType<T>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, result: { fieldErrors: toFieldErrors(result.error) } };
}

/** Moves focus to the first invalid field, in form order. */
export function focusFirstInvalid(form: HTMLFormElement, errors: FieldErrors) {
  for (const element of form.elements) {
    const name = (element as HTMLInputElement).name;
    if (name && name in errors) {
      (element as HTMLElement).focus?.();
      return;
    }
  }
}
