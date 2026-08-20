import JSZip from "jszip";
import { bytesToBlob } from "../lib/util.js";

export const INPUT_EXTS = ["zip"];

export async function filesToZip(files, zipName = "archive.zip") {
  const zip = new JSZip();
  const usedNames = new Set();
  for (const file of files) {
    let name = file.name;
    let i = 1;
    while (usedNames.has(name)) name = `${file.name}-${i++}`;
    usedNames.add(name);
    zip.file(name, await file.arrayBuffer());
  }
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return { blob: bytesToBlob(bytes, "application/zip"), filename: zipName };
}

export async function listZipEntries(file) {
  const zip = await JSZip.loadAsync(file);
  const entries = [];
  zip.forEach((relPath, entry) => {
    if (!entry.dir) entries.push({ name: relPath, size: entry._data ? entry._data.uncompressedSize : 0 });
  });
  return { zip, entries };
}

export async function extractZipEntry(zip, entryName) {
  const bytes = await zip.file(entryName).async("uint8array");
  return bytesToBlob(bytes, "application/octet-stream");
}
