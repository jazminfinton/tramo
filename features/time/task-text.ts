// What shared tasks and entries say in words. Pure, so the server, the
// client and the tests agree.

/** The longest name a shared task takes. */
export const TASK_NAME_MAX = 60;

/** A name as people typed it, tidied: trimmed, single spaces. */
export function tidyTaskName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** A name as it is compared: tidied and lowercase, so "Daily" and "daily" are one task. */
export function taskNameKey(name: string): string {
  return tidyTaskName(name).toLocaleLowerCase("es");
}

/**
 * What an entry is called in a list: its shared task first, then the detail
 * the person wrote. Empty when it has neither.
 */
export function entryTitle(entry: { task: { name: string } | null; description: string }): string {
  return [entry.task?.name, entry.description].filter(Boolean).join(" · ");
}
