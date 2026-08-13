/**
 * lib/mpesa/sms.ts
 *
 * Android-only helpers: ask for SMS permission and list recent M-Pesa messages.
 * Wrapped so a missing native module (Expo Go / iOS) never crashes the app.
 */

import { PermissionsAndroid, Platform } from "react-native";
import { parseMpesaSms, type ParsedMpesa } from "@/lib/mpesa/parse";

export interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  parsed: ParsedMpesa | null;
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

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);

  return (
    granted[PermissionsAndroid.PERMISSIONS.READ_SMS] ===
      PermissionsAndroid.RESULTS.GRANTED &&
    granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] ===
      PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

/**
 * Lists recent inbox SMS that look like M-Pesa, newest first.
 * Resolves to [] when permission is missing or the native module is absent.
 */
export function listMpesaSms(limit = 40): Promise<SmsMessage[]> {
  const SmsAndroid = getSmsAndroid();
  if (!SmsAndroid) return Promise.resolve([]);

  const filter = JSON.stringify({
    box: "inbox",
    maxCount: Math.max(limit * 3, 60),
    indexFrom: 0,
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

          const mapped = rows
            .map((row) => {
              const body = row.body ?? "";
              const parsed = parseMpesaSms(body);
              return {
                id: String(row._id ?? `${row.date}-${body.slice(0, 12)}`),
                address: row.address ?? "",
                body,
                date: Number(row.date) || Date.now(),
                parsed,
              } satisfies SmsMessage;
            })
            .filter((row) => {
              const addr = row.address.toUpperCase();
              return (
                row.parsed !== null ||
                addr.includes("MPESA") ||
                /m-?pesa/i.test(row.body)
              );
            })
            .filter((row) => row.parsed !== null)
            .slice(0, limit);

          resolve(mapped);
        } catch {
          resolve([]);
        }
      },
    );
  });
}
