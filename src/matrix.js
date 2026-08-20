// Declarative routing table: source extension -> selectable target formats.
// Ext lists are duplicated here (rather than imported from the converter
// modules) on purpose — converter modules pull in heavy libraries (pdfjs,
// mammoth, xlsx, ffmpeg...) and importing them just to read a constant would
// defeat the whole point of lazy-loading those modules only on conversion.

const IMAGE_IN = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif", "tif", "tiff"];
const IMAGE_OUT = ["png", "jpg", "webp", "bmp", "tif", "tiff", "ico", "avif"];
const TEXT_IN = ["txt", "log", "md", "markdown", "html", "htm", "json", "csv", "tsv", "xml", "yaml", "yml"];
const TEXT_OUT = ["txt", "md", "html", "json", "csv", "yaml", "xml", "pdf", "docx", "epub"];
const SHEET_IN = ["xlsx"];
const SHEET_OUT = ["xlsx", "csv", "html", "json"];
const DOCX_OUT = ["html", "md", "txt", "pdf"];
const PDF_OUT = ["txt", "html", "docx", "png", "jpg", "zip"];
const EPUB_OUT = ["txt", "md", "html"];
const AUDIO_IN = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "wma"];
const AUDIO_OUT = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"];
const VIDEO_IN = ["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv"];
const VIDEO_OUT = ["mp4", "webm", "mkv", "mov", "gif", "mp3", "wav", "flac", "m4a", "ogg", "aac"];

function entries(exts, module, labelFn) {
  return exts.map((ext) => ({ ext, module, label: labelFn ? labelFn(ext) : ext.toUpperCase() }));
}

const MATRIX = {};
for (const ext of IMAGE_IN) MATRIX[ext] = entries(IMAGE_OUT.filter((e) => e !== ext), "images");
for (const ext of TEXT_IN) MATRIX[ext] = entries(TEXT_OUT.filter((e) => e !== ext), "text");
for (const ext of SHEET_IN) MATRIX[ext] = entries(SHEET_OUT.filter((e) => e !== ext), "sheet");
MATRIX.docx = entries(DOCX_OUT, "docx");
MATRIX.pdf = entries(PDF_OUT, "pdf");
MATRIX.epub = entries(EPUB_OUT, "epub");
for (const ext of AUDIO_IN) MATRIX[ext] = entries(AUDIO_OUT.filter((e) => e !== ext), "av");
for (const ext of VIDEO_IN) MATRIX[ext] = entries(VIDEO_OUT.filter((e) => e !== ext), "av");

// csv/tsv can also become a real xlsx workbook, not just other text formats
MATRIX.csv = [...MATRIX.csv, ...entries(["xlsx"], "sheet")];
MATRIX.tsv = [...MATRIX.tsv, ...entries(["xlsx"], "sheet")];

// OCR: extra "txt (OCR)" target on top of whatever the base module already offers
for (const ext of IMAGE_IN) {
  MATRIX[ext].push({ ext: "txt", module: "ocr", label: "TXT（OCR 文字辨識）" });
}
MATRIX.pdf.push({ ext: "txt", module: "ocr-pdf", label: "TXT（OCR 掃描辨識）" });

export function targetsForExt(ext) {
  return MATRIX[ext] || [];
}

export function isKnownInputExt(ext) {
  return ext in MATRIX || ext === "zip";
}

export const OCR_IMAGE_EXTS = IMAGE_IN;
export const ZIPPABLE = true;
