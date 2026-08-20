import { marked } from "marked";
import TurndownService from "turndown";
import yaml from "js-yaml";
import { baseName, bytesToBlob } from "../lib/util.js";
import { parseCsv, rowsToObjects, objectsToCsv } from "../lib/csv.js";
import { textToPdfBytes, textToDocxBlob } from "../lib/doc-export.js";
import { writeEpub } from "./epub.js";

export const INPUT_EXTS = ["txt", "log", "md", "markdown", "html", "htm", "json", "csv", "tsv", "xml", "yaml", "yml"];
export const OUTPUT_EXTS = ["txt", "md", "html", "json", "csv", "yaml", "xml", "pdf", "docx", "epub"];

const turndown = new TurndownService();

function stripTags(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body ? doc.body.textContent.trim() : "";
}

function xmlToJsonValue(el) {
  const children = Array.from(el.children);
  if (children.length === 0) return el.textContent;
  const out = {};
  for (const child of children) {
    const value = xmlToJsonValue(child);
    if (out[child.tagName] === undefined) out[child.tagName] = value;
    else if (Array.isArray(out[child.tagName])) out[child.tagName].push(value);
    else out[child.tagName] = [out[child.tagName], value];
  }
  return out;
}

function jsonToXmlValue(key, value, indent) {
  const pad = "  ".repeat(indent);
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const inner = Object.entries(value).map(([k, v]) => jsonToXmlValue(k, v, indent + 1)).join("\n");
    return `${pad}<${key}>\n${inner}\n${pad}</${key}>`;
  }
  if (Array.isArray(value)) {
    return value.map((v) => jsonToXmlValue(key, v, indent)).join("\n");
  }
  const text = String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `${pad}<${key}>${text}</${key}>`;
}

// --- normalize any supported source into an intermediate {text, html, json} bag ---
async function toIntermediate(file, sourceExt) {
  const raw = await file.text();
  const ext = sourceExt === "markdown" ? "md" : sourceExt === "htm" ? "html" : sourceExt === "yml" ? "yaml" : sourceExt === "log" ? "txt" : sourceExt;

  if (ext === "md") return { text: raw, html: marked.parse(raw) };
  if (ext === "html") return { text: stripTags(raw), html: raw };
  if (ext === "txt") return { text: raw, html: `<pre>${raw.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>` };
  if (ext === "json") {
    const data = JSON.parse(raw);
    return { text: JSON.stringify(data, null, 2), json: data };
  }
  if (ext === "yaml") {
    const data = yaml.load(raw);
    return { text: raw, json: data };
  }
  if (ext === "csv" || ext === "tsv") {
    const rows = parseCsv(ext === "tsv" ? raw.replace(/\t/g, ",") : raw);
    const objects = rowsToObjects(rows);
    return { text: raw, json: objects, rows };
  }
  if (ext === "xml") {
    const doc = new DOMParser().parseFromString(raw, "application/xml");
    return { text: raw, json: { [doc.documentElement.tagName]: xmlToJsonValue(doc.documentElement) } };
  }
  throw new Error(`不支援的來源格式：${sourceExt}`);
}

export async function convert(file, sourceExt, targetExt) {
  const outName = `${baseName(file.name)}.${targetExt}`;
  const mid = await toIntermediate(file, sourceExt);

  if (targetExt === "txt") {
    const text = mid.text ?? (mid.json ? JSON.stringify(mid.json, null, 2) : "");
    return { blob: bytesToBlob(new TextEncoder().encode(text), "text/plain"), filename: outName };
  }
  if (targetExt === "html") {
    const html = mid.html ?? `<pre>${(mid.text || JSON.stringify(mid.json, null, 2)).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;
    return { blob: bytesToBlob(new TextEncoder().encode(html), "text/html"), filename: outName };
  }
  if (targetExt === "md") {
    const md = mid.html ? turndown.turndown(mid.html) : mid.rows ? toMarkdownTable(mid.rows) : mid.text ?? JSON.stringify(mid.json, null, 2);
    return { blob: bytesToBlob(new TextEncoder().encode(md), "text/markdown"), filename: outName };
  }
  if (targetExt === "json") {
    const data = mid.json ?? mid.text;
    return { blob: bytesToBlob(new TextEncoder().encode(JSON.stringify(data, null, 2)), "application/json"), filename: outName };
  }
  if (targetExt === "yaml") {
    const data = mid.json ?? mid.text;
    return { blob: bytesToBlob(new TextEncoder().encode(yaml.dump(data)), "text/yaml"), filename: outName };
  }
  if (targetExt === "xml") {
    const data = mid.json ?? (Array.isArray(mid.rows) ? rowsToObjects(mid.rows) : { value: mid.text });
    const rootObj = typeof data === "object" && !Array.isArray(data) ? data : { item: data };
    const body = Object.entries(rootObj).map(([k, v]) => jsonToXmlValue(k, v, 1)).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${body}\n</root>`;
    return { blob: bytesToBlob(new TextEncoder().encode(xml), "application/xml"), filename: outName };
  }
  if (targetExt === "csv") {
    const objects = Array.isArray(mid.json) ? mid.json : mid.json ? [mid.json] : [];
    if (objects.length === 0) throw new Error("此內容無法轉成表格 CSV（需要陣列或物件資料）");
    return { blob: bytesToBlob(new TextEncoder().encode("﻿" + objectsToCsv(objects)), "text/csv"), filename: outName };
  }
  if (targetExt === "pdf") {
    const text = mid.text ?? JSON.stringify(mid.json, null, 2);
    const bytes = await textToPdfBytes(text);
    return { blob: bytesToBlob(bytes, "application/pdf"), filename: outName };
  }
  if (targetExt === "docx") {
    const text = mid.text ?? JSON.stringify(mid.json, null, 2);
    const blob = await textToDocxBlob(text);
    return { blob, filename: outName };
  }
  if (targetExt === "epub") {
    const html = mid.html ?? `<pre>${(mid.text || JSON.stringify(mid.json, null, 2)).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;
    const bytes = await writeEpub(html, baseName(file.name));
    return { blob: bytesToBlob(bytes, "application/epub+zip"), filename: outName };
  }
  throw new Error(`不支援輸出格式：${targetExt}`);
}

function toMarkdownTable(rows) {
  if (rows.length === 0) return "";
  const [header, ...rest] = rows;
  const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
  for (const r of rest) lines.push(`| ${r.join(" | ")} |`);
  return lines.join("\n");
}
