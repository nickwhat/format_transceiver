import UTIF from "utif";
import { baseName, bytesToBlob } from "../lib/util.js";

export const INPUT_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif", "tif", "tiff"];
export const OUTPUT_EXTS = ["png", "jpg", "webp", "bmp", "tif", "tiff", "ico", "avif"];

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif" };

async function decodeToCanvas(file, ext) {
  if (ext === "tif" || ext === "tiff") {
    const buf = await file.arrayBuffer();
    const ifds = UTIF.decode(buf);
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const { width, height } = ifds[0];
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), width, height), 0, 0);
    return canvas;
  }
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function encodeBmp(imageData) {
  const { width, height, data } = imageData;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelArraySize, true);
  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    let rowStart = offset;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      view.setUint8(rowStart++, data[i + 2]);
      view.setUint8(rowStart++, data[i + 1]);
      view.setUint8(rowStart++, data[i]);
    }
    offset += rowSize;
  }
  return new Uint8Array(buf);
}

async function encodeIco(canvas) {
  const size = Math.min(256, Math.max(canvas.width, canvas.height));
  let src = canvas;
  if (canvas.width !== size || canvas.height !== size) {
    src = new OffscreenCanvas(size, size);
    src.getContext("2d").drawImage(canvas, 0, 0, size, size);
  }
  const pngBlob = await src.convertToBlob({ type: "image/png" });
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const header = new ArrayBuffer(6 + 16);
  const view = new DataView(header);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  view.setUint8(6, size >= 256 ? 0 : size);
  view.setUint8(7, size >= 256 ? 0 : size);
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.byteLength, true);
  view.setUint32(18, 22, true);
  const out = new Uint8Array(22 + pngBytes.byteLength);
  out.set(new Uint8Array(header), 0);
  out.set(pngBytes, 22);
  return out;
}

export async function convert(file, sourceExt, targetExt) {
  const canvas = await decodeToCanvas(file, sourceExt);
  const outName = `${baseName(file.name)}.${targetExt}`;

  if (targetExt === "tif" || targetExt === "tiff") {
    const ctx = canvas.getContext("2d");
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tiffBuf = UTIF.encodeImage(data, width, height);
    return { blob: bytesToBlob(tiffBuf, "image/tiff"), filename: outName };
  }
  if (targetExt === "bmp") {
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { blob: bytesToBlob(encodeBmp(imageData), "image/bmp"), filename: outName };
  }
  if (targetExt === "ico") {
    const bytes = await encodeIco(canvas);
    return { blob: bytesToBlob(bytes, "image/x-icon"), filename: outName };
  }

  const mime = MIME[targetExt];
  if (!mime) throw new Error(`不支援輸出格式：${targetExt}`);
  const blob = await canvas.convertToBlob({ type: mime, quality: 0.92 });
  if (!blob) throw new Error(`此瀏覽器不支援編碼為 ${targetExt.toUpperCase()}`);
  return { blob, filename: outName };
}
