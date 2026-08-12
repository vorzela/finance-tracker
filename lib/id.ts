/**
 * lib/id.ts
 *
 * Local identifiers. Hermes has no `crypto.randomUUID`, and these IDs never
 * leave the device, so a timestamp plus a random suffix is collision-safe
 * enough while staying sortable by creation time.
 */

export function uid(prefix = "tx"): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${rand}`;
}
