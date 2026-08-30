/**
 * lib/mpesa/sms.ts
 *
 * Android-only helpers: ask for SMS permission and list recent wallet SMS.
 * Results are deduped by M-Pesa confirmation code (Fuliza sends two SMS).
 */

import { PermissionsAndroid, Platform } from "react-native";
import {
  dedupeByMpesaCode,
  parseMpesaSms,
  type ParsedMpesa,
} from "@/lib/mpesa/parse";

export interface SmsMessage {
  /** Stable list key — the M-Pesa code when present. */
  id: string;
  address: string;
  body: string;
  date: number;
  parsed: ParsedMpesa;
}

type SmsAndroidModule = {
  list: (
    filter: string,
    fail: (err: string) => void,
    success: (count: number, list: string) => void,
  ) => void;
};

function getSmsAndroid(): SmsAndroidModule | null {
  if (Platform.OS !== "android") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-get-sms-android") as SmsAndroidModule;
  } catch {
    return null;
  }
}

export function canReadSmsNative(): boolean {
  return getSmsAndroid() !== null;
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  // Only READ_SMS is needed: the inbox is read on demand via SmsAndroid.list.
  // RECEIVE_SMS would only be needed to listen for *live* incoming SMS, which
  // this app never does — requesting it anyway is an unused dangerous
  // permission that adds risk without adding functionality.
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

/**
 * Lists recent inbox SMS for M-Pesa / Fuliza / M-Shwari / Ziidi / Pochi, one
 * row per confirmation code. Resolves to [] when permission or the native
 * module is missing — the UI then falls back to paste / manual entry.
 *
 * `minDate`, when given (epoch ms), is passed straight to the native SMS
 * query so messages older than that are never even read off the device —
 * not just filtered out afterward. Useful both for "don't show me years of
 * old texts" and, since READ_SMS is a sensitive permission, for reading as
 * little of the inbox as actually needed.
 */
export function listMpesaSms(limit = 40, minDate?: number): Promise<SmsMessage[]> {
  const SmsAndroid = getSmsAndroid();
  if (!SmsAndroid) return Promise.resolve([]);

  const filter = JSON.stringify({
    box: "inbox",
    maxCount: Math.max(limit * 4, 80),
    indexFrom: 0,
    ...(minDate ? { minDate } : {}),
  });

  return new Promise((resolve) => {
    SmsAndroid.list(
      filter,
      () => resolve([]),
      (_count, response) => {
        try {
          const rows = JSON.parse(response) as {
            _id?: string | number;
            address?: string;
            body?: string;
            date?: string | number;
          }[];

          const parsedRows = rows
            .map((row) => {
              const body = row.body ?? "";
              const parsed = parseMpesaSms(body);
              if (!parsed) return null;
              return {
                address: row.address ?? "",
                body,
                date: Number(row.date) || Date.now(),
                parsed,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
            .filter((row) => {
              const addr = row.address.toUpperCase();
              return (
                addr.includes("MPESA") ||
                addr.includes("SAFARICOM") ||
                /m-?pesa|fuliza|m-?shwari|ziidi|zidii|pochi|biashara/i.test(row.body)
              );
            });

          const unique = dedupeByMpesaCode(parsedRows.map((row) => row.parsed)).slice(
            0,
            limit,
          );

          resolve(
            unique.map((parsed) => {
              // Prefer the winning SMS body (after Fuliza code-dedupe), not an
              // arbitrary sibling that shared the same confirmation code.
              const source =
                parsedRows.find((row) => row.parsed.raw === parsed.raw) ??
                parsedRows.find(
                  (row) =>
                    parsed.reference != null &&
                    row.parsed.reference === parsed.reference,
                );
              return {
                id: parsed.reference ?? `body-${parsed.raw.slice(0, 24)}`,
                address: source?.address ?? "MPESA",
                body: parsed.raw,
                date: source?.date ?? Date.now(),
                parsed,
              } satisfies SmsMessage;
            }),
          );
        } catch {
          resolve([]);
        }
      },
    );
  });
}
