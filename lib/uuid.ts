/**
 * lib/uuid.ts
 *
 * Client UUIDs for offline-created rows. Hermes has no crypto.randomUUID.
 */

export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}
