import { PDFDocument } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";

// Text is rasterized via <canvas> using the browser's own font stack instead of
// pdf-lib's built-in Latin-only fonts, so CJK/Thai/etc. text never hits pdf-lib's
// "cannot encode this character" error. Output text isn't selectable, but every
// script the browser can render comes out correct — that trade-off is intentional.
const DPI_SCALE = 150 / 72; // render at 150dpi, PDF page stays A4-at-72dpi in points
const PAGE_W_PT = 595.28;
const PAGE_H_PT = 841.89;
const MARGIN_PT = 50;
const FONT_SIZE_PT = 11;
const LINE_HEIGHT_PT = 16;

function wrapLine(ctx, line, maxWidthPx) {
  if (line === "") return [""];
  const words = line.split(/(\s+)/);
  const out = [];
  let current = "";
  for (const word of words) {
    const trial = current + word;
    if (ctx.measureText(trial).width > maxWidthPx && current !== "") {
      out.push(current);
      current = word.trimStart();
    } else {
      current = trial;
    }
  }
  if (current) out.push(current);
  return out.length ? out : [""];
}

function newPageCanvas() {
  const canvas = new OffscreenCanvas(Math.round(PAGE_W_PT * DPI_SCALE), Math.round(PAGE_H_PT * DPI_SCALE));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.font = `${FONT_SIZE_PT * DPI_SCALE}px sans-serif`;
  ctx.textBaseline = "top";
  return { canvas, ctx };
}

export async function textToPdfBytes(text) {
  const pdf = await PDFDocument.create();
  const marginPx = MARGIN_PT * DPI_SCALE;
  const lineHeightPx = LINE_HEIGHT_PT * DPI_SCALE;
  const maxWidthPx = (PAGE_W_PT - MARGIN_PT * 2) * DPI_SCALE;

  let { canvas, ctx } = newPageCanvas();
  let yPx = marginPx;
  const pages = [];

  const rawLines = text.split("\n");
  for (const raw of rawLines) {
    const wrapped = wrapLine(ctx, raw, maxWidthPx);
    for (const line of wrapped) {
      if (yPx + lineHeightPx > canvas.height - marginPx) {
        pages.push(canvas);
        ({ canvas, ctx } = newPageCanvas());
        yPx = marginPx;
      }
      ctx.fillText(line, marginPx, yPx);
      yPx += lineHeightPx;
    }
  }
  pages.push(canvas);

  for (const pageCanvas of pages) {
    const pngBlob = await pageCanvas.convertToBlob({ type: "image/png" });
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const embedded = await pdf.embedPng(pngBytes);
    const page = pdf.addPage([PAGE_W_PT, PAGE_H_PT]);
    page.drawImage(embedded, { x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT });
  }
  return pdf.save();
}

export async function textToDocxBlob(text) {
  const paragraphs = text.split("\n").map((line) => new Paragraph(line));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}
