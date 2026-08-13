/**
 * lib/report.ts
 *
 * Builds a printable monthly money report PDF you can share with an AI (or a
 * partner) for advice on where to save and what to cut.
 *
 * expo-print / expo-sharing are loaded lazily so Insights does not crash when
 * the native modules are missing from an older APK.
 */

import { formatMoney } from "@/lib/currency";
import { monthLabel, shortWhenLabel } from "@/lib/date";
import { getCategory } from "@/lib/categories";
import type { MonthOverview } from "@/types/finance";
import type { TransactionRow } from "@/types/database";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMonthReportHtml(args: {
  monthKey: string;
  currency: string;
  overview: MonthOverview;
  rows: TransactionRow[];
  scopeLabel: string;
}): string {
  const { monthKey, currency, overview, rows, scopeLabel } = args;
  const title = `Duo Wallet · ${monthLabel(monthKey)}`;
  const spent = formatMoney(overview.totals.spent, currency);
  const earned = formatMoney(overview.totals.earned, currency);
  const net = formatMoney(overview.totals.net, currency);
  const fees = formatMoney(overview.totals.fees, currency);

  const categories = overview.categories
    .map(
      (category) => `
      <tr>
        <td>${esc(category.label)}</td>
        <td class="num">${category.count}</td>
        <td class="num">${esc(formatMoney(category.total, currency))}</td>
        <td class="num">${Math.round(category.share * 100)}%</td>
      </tr>`,
    )
    .join("");

  const ledger = [...rows]
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
    .map((row) => {
      const sign = row.kind === "income" ? "+" : row.kind === "transfer" ? "↔" : "−";
      const cat =
        row.kind === "transfer" ? "Transfer" : getCategory(row.category_id).label;
      const fee =
        row.fee_amount > 0
          ? ` · fee ${formatMoney(row.fee_amount, currency)}`
          : "";
      return `
      <tr>
        <td>${esc(shortWhenLabel(row.occurred_at))}</td>
        <td>${esc(cat)}</td>
        <td>${esc(row.note?.trim() || "—")}</td>
        <td class="num">${sign}${esc(formatMoney(row.amount, currency))}${esc(fee)}</td>
      </tr>`;
    })
    .join("");

  const topCuts = overview.categories
    .slice(0, 5)
    .map((c) => `${c.label} (${formatMoney(c.total, currency)})`)
    .join("; ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; padding: 28px; font-size: 12px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 24px 0 8px; color: #1e3a5f; }
    .muted { color: #6b7280; margin: 0 0 16px; }
    .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; min-width: 120px; }
    .card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; }
    .card .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #eee; vertical-align: top; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .prompt { background: #f3f6fb; border-radius: 10px; padding: 12px 14px; margin-top: 20px; line-height: 1.45; }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="muted">${esc(scopeLabel)} ledger · generated for advice (save more / spend less)</p>

  <div class="cards">
    <div class="card"><div class="label">Spent</div><div class="value">${esc(spent)}</div></div>
    <div class="card"><div class="label">Earned</div><div class="value">${esc(earned)}</div></div>
    <div class="card"><div class="label">Net</div><div class="value">${esc(net)}</div></div>
    <div class="card"><div class="label">Fees</div><div class="value">${esc(fees)}</div></div>
  </div>

  <h2>Spending by category</h2>
  <table>
    <thead><tr><th>Category</th><th class="num">Entries</th><th class="num">Total</th><th class="num">Share</th></tr></thead>
    <tbody>${categories || "<tr><td colspan='4'>No expenses this month.</td></tr>"}</tbody>
  </table>

  <h2>All entries</h2>
  <table>
    <thead><tr><th>When</th><th>Category</th><th>Note</th><th class="num">Amount</th></tr></thead>
    <tbody>${ledger || "<tr><td colspan='4'>No entries.</td></tr>"}</tbody>
  </table>

  <div class="prompt">
    <strong>Ask an AI:</strong> Based on this ${esc(monthLabel(monthKey))} report
    (top categories: ${esc(topCuts || "none")}), where should I save more,
    and what should I reduce? Suggest a simple monthly plan in Kenya shillings.
  </div>
</body>
</html>`;
}

/** Create a PDF and open the system share sheet. */
export async function shareMonthReportPdf(args: {
  monthKey: string;
  currency: string;
  overview: MonthOverview;
  rows: TransactionRow[];
  scopeLabel: string;
}): Promise<void> {
  let Print: typeof import("expo-print");
  let Sharing: typeof import("expo-sharing");
  try {
    Print = await import("expo-print");
    Sharing = await import("expo-sharing");
  } catch {
    throw new Error(
      "PDF export needs a rebuild with expo-print. Use a fresh APK, or copy the Insights totals manually.",
    );
  }

  const html = buildMonthReportHtml(args);
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    await Print.printAsync({ uri });
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Share ${monthLabel(args.monthKey)} money report`,
    UTI: "com.adobe.pdf",
  });
}
