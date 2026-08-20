import mammoth from "mammoth";
import TurndownService from "turndown";
import { baseName, bytesToBlob } from "../lib/util.js";
import { textToPdfBytes } from "../lib/doc-export.js";

export const INPUT_EXTS = ["docx"];
export const OUTPUT_EXTS = ["html", "md", "txt", "pdf"];

export async function convert(file, sourceExt, targetExt) {
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const outName = `${baseName(file.name)}.${targetExt}`;

  if (targetExt === "html") {
    return { blob: bytesToBlob(new TextEncoder().encode(html), "text/html"), filename: outName };
  }
  if (targetExt === "md") {
    const md = new TurndownService().turndown(html);
    return { blob: bytesToBlob(new TextEncoder().encode(md), "text/markdown"), filename: outName };
  }
  if (targetExt === "txt") {
    const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf });
    return { blob: bytesToBlob(new TextEncoder().encode(text), "text/plain"), filename: outName };
  }
  if (targetExt === "pdf") {
    const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf });
    const bytes = await textToPdfBytes(text);
    return { blob: bytesToBlob(bytes, "application/pdf"), filename: outName };
  }
  throw new Error(`DOCX 不支援輸出成 ${targetExt}（版面配置無法還原，僅支援文字類輸出）`);
}
