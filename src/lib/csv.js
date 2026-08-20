export function parseCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip, \n handles the row break
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function rowsToObjects(rows) {
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function csvField(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function objectsToCsv(objects) {
  if (objects.length === 0) return "";
  const header = Array.from(objects.reduce((set, o) => { Object.keys(o).forEach((k) => set.add(k)); return set; }, new Set()));
  const lines = [header.map(csvField).join(",")];
  for (const o of objects) lines.push(header.map((h) => csvField(o[h])).join(","));
  return lines.join("\r\n");
}

export function rowsToCsv(rows) {
  return rows.map((r) => r.map(csvField).join(",")).join("\r\n");
}
