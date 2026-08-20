import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { baseName, bytesToBlob } from "../lib/util.js";
import { textToDocxBlob } from "../lib/doc-export.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export const INPUT_EXTS = ["pdf"];
export const OUTPUT_EXTS = ["txt", "html", "docx", "png", "jpg", "zip"];

async function loadPdf(file) {
  const buf = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: buf }).promise;
}

async function extractText(pdf) {
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => it.str).join(" "));
  }
  return pages;
}

async function renderPageToPngBytes(pdf, pageNum, scale = 2) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function convert(file, sourceExt, targetExt) {
  const outBase = baseName(file.name);

  if (targetExt === "txt") {
    const pdf = await loadPdf(file);
    const pages = await extractText(pdf);
    return { blob: bytesToBlob(new TextEncoder().encode(pages.join("\n\n")), "text/plain"), filename: `${outBase}.txt` };
  }
  if (targetExt === "html") {
    const pdf = await loadPdf(file);
    const pages = await extractText(pdf);
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = pages.map((p, i) => `<section><h2>第 ${i + 1} 頁</h2><p>${esc(p)}</p></section>`).join("\n");
    return { blob: bytesToBlob(new TextEncoder().encode(`<!doctype html><meta charset="utf-8">${html}`), "text/html"), filename: `${outBase}.html` };
  }
  if (targetExt === "docx") {
    const pdf = await loadPdf(file);
    const pages = await extractText(pdf);
    const blob = await textToDocxBlob(pages.join("\n\n"));
    return { blob, filename: `${outBase}.docx` };
  }
  if (targetExt === "png" || targetExt === "jpg") {
    const pdf = await loadPdf(file);
    const mime = targetExt === "png" ? "image/png" : "image/jpeg";
    if (pdf.numPages === 1) {
      const pngBytes = await renderPageToPngBytes(pdf, 1);
      if (targetExt === "png") return { blob: bytesToBlob(pngBytes, mime), filename: `${outBase}.png` };
      const jpgBlob = await reencodeAsJpeg(pngBytes);
      return { blob: jpgBlob, filename: `${outBase}.jpg` };
    }
    const zip = new JSZip();
    for (let i = 1; i <= pdf.numPages; i++) {
      const pngBytes = await renderPageToPngBytes(pdf, i);
      if (targetExt === "png") zip.file(`page-${String(i).padStart(3, "0")}.png`, pngBytes);
      else zip.file(`page-${String(i).padStart(3, "0")}.jpg`, await (await reencodeAsJpeg(pngBytes)).arrayBuffer());
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    return { blob: bytesToBlob(bytes, "application/zip"), filename: `${outBase}-pages.zip` };
  }
  if (targetExt === "zip") {
    // split into one PDF file per page, packed as a zip
    const srcBytes = await file.arrayBuffer();
    const src = await PDFDocument.load(srcBytes);
    const zip = new JSZip();
    for (let i = 0; i < src.getPageCount(); i++) {
      const out = await PDFDocument.create();
      const [copied] = await out.copyPages(src, [i]);
      out.addPage(copied);
      const bytes = await out.save();
      zip.file(`page-${String(i + 1).padStart(3, "0")}.pdf`, bytes);
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    return { blob: bytesToBlob(bytes, "application/zip"), filename: `${outBase}-split.zip` };
  }
  throw new Error(`不支援輸出格式：${targetExt}`);
}

async function reencodeAsJpeg(pngBytes) {
  const blob = new Blob([pngBytes], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
}

export async function mergePdfs(files) {
  const out = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const src = await PDFDocument.load(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const bytes = await out.save();
  return { blob: bytesToBlob(bytes, "application/pdf"), filename: "merged.pdf" };
}

export async function imagesToPdf(files) {
  const out = await PDFDocument.create();
  for (const file of files) {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pngBlob = await canvas.convertToBlob({ type: "image/png" });
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const embedded = await out.embedPng(pngBytes);
    const page = out.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  const bytes = await out.save();
  return { blob: bytesToBlob(bytes, "application/pdf"), filename: "images.pdf" };
}
