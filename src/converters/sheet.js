import ExcelJS from "exceljs";
import { baseName, bytesToBlob } from "../lib/util.js";
import { parseCsv, rowsToObjects, rowsToCsv } from "../lib/csv.js";

// Deliberately xlsx + csv only. The npm-published `xlsx` (SheetJS) package that
// would add legacy .xls/.ods support is frozen at 0.18.5 with an unpatched
// prototype-pollution/ReDoS advisory (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9);
// the fixed releases only ship from SheetJS's own CDN. Since this app's entire
// job is parsing files a user just dragged in, shipping a known-vulnerable
// parser for that exact input isn't worth it — .xls/.ods import is a gap, not
// silently broken.
export const INPUT_EXTS = ["xlsx", "csv"];
export const OUTPUT_EXTS = ["xlsx", "csv", "html", "json"];

function cellToValue(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return v.result ?? "";
    if ("text" in v) return v.text;
    return "";
  }
  return v;
}

async function loadWorkbook(file, ext) {
  const wb = new ExcelJS.Workbook();
  if (ext === "csv") {
    const text = await file.text();
    const ws = wb.addWorksheet("Sheet1");
    parseCsv(text).forEach((r) => ws.addRow(r));
    return wb;
  }
  const buf = await file.arrayBuffer();
  await wb.xlsx.load(buf);
  return wb;
}

function sheetToRows(ws) {
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push(row.values.slice(1).map(cellToValue));
  });
  return rows;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function convert(file, sourceExt, targetExt) {
  const wb = await loadWorkbook(file, sourceExt);
  const ws = wb.worksheets[0];
  const rows = sheetToRows(ws);
  const outName = `${baseName(file.name)}.${targetExt}`;

  if (targetExt === "csv") {
    return { blob: bytesToBlob(new TextEncoder().encode("﻿" + rowsToCsv(rows)), "text/csv"), filename: outName };
  }
  if (targetExt === "json") {
    const objects = rowsToObjects(rows);
    return { blob: bytesToBlob(new TextEncoder().encode(JSON.stringify(objects, null, 2)), "application/json"), filename: outName };
  }
  if (targetExt === "html") {
    const html = `<table>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`).join("")}</table>`;
    return { blob: bytesToBlob(new TextEncoder().encode(`<!doctype html><meta charset="utf-8">${html}`), "text/html"), filename: outName };
  }
  if (targetExt === "xlsx") {
    const buf = await wb.xlsx.writeBuffer();
    return { blob: bytesToBlob(new Uint8Array(buf), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), filename: outName };
  }
  throw new Error(`不支援輸出格式：${targetExt}`);
}
