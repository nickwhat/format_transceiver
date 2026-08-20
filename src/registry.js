import { baseName } from "./lib/util.js";

const LOADERS = {
  images: () => import("./converters/images.js"),
  text: () => import("./converters/text.js"),
  sheet: () => import("./converters/sheet.js"),
  docx: () => import("./converters/docx.js"),
  pdf: () => import("./converters/pdf.js"),
  epub: () => import("./converters/epub.js"),
  av: () => import("./converters/av.js"),
  ocr: () => import("./converters/ocr.js")
};

export async function convertFile(file, sourceExt, targetExt, moduleKey, opts = {}) {
  if (moduleKey === "ocr-pdf") {
    const { scannedPdfToText } = await import("./converters/ocr.js");
    const text = await scannedPdfToText(file, opts.lang, opts.onProgress);
    return { blob: new Blob([text], { type: "text/plain" }), filename: `${baseName(file.name)}.txt` };
  }
  const load = LOADERS[moduleKey];
  if (!load) throw new Error(`未知的轉換模組：${moduleKey}`);
  const mod = await load();
  return mod.convert(file, sourceExt, targetExt, opts);
}

export async function mergePdfs(files) {
  const mod = await LOADERS.pdf();
  return mod.mergePdfs(files);
}

export async function imagesToPdf(files) {
  const mod = await LOADERS.pdf();
  return mod.imagesToPdf(files);
}

export async function filesToZip(files, zipName) {
  const mod = await import("./converters/zip.js");
  return mod.filesToZip(files, zipName);
}

export async function listZipEntries(file) {
  const mod = await import("./converters/zip.js");
  return mod.listZipEntries(file);
}

export async function extractZipEntry(zip, entryName) {
  const mod = await import("./converters/zip.js");
  return mod.extractZipEntry(zip, entryName);
}
