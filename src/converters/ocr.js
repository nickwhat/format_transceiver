import { baseName, bytesToBlob } from "../lib/util.js";

// Lazy-loaded: tesseract.js pulls its wasm core + language traineddata from a
// public CDN (jsdelivr) on first use. Everything else in this app is fully
// self-contained on GitHub Pages; OCR language data is the one deliberate
// exception, documented in the README, because vendoring every language's
// traineddata into the git repo would bloat it for a rarely-used feature.
export async function imageToText(file, lang = "eng") {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export async function convert(file, sourceExt, targetExt, opts = {}) {
  if (targetExt !== "txt") throw new Error("OCR 只能輸出成 txt");
  const text = await imageToText(file, opts.lang || "eng");
  return { blob: bytesToBlob(new TextEncoder().encode(text), "text/plain"), filename: `${baseName(file.name)}.txt` };
}

export async function scannedPdfToText(file, lang = "eng", onProgress) {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfjsWorkerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  const { createWorker } = await import("tesseract.js");

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const worker = await createWorker(lang);
  const texts = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(i / pdf.numPages, `OCR 第 ${i}/${pdf.numPages} 頁`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const { data } = await worker.recognize(blob);
      texts.push(data.text);
    }
  } finally {
    await worker.terminate();
  }
  return texts.join("\n\n");
}
