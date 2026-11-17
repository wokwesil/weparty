/** One CSV cell, safe to open in Excel/Sheets (blocks formula injection). */
export const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows to a UTF-8 CSV file body (with BOM so Excel reads emoji and accents). */
export const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
