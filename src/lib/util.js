export function extOf(filename) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

export function baseName(filename) {
  const withoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, "");
  return withoutExt || filename;
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function readAsText(file) {
  return file.text();
}

export async function readAsArrayBuffer(file) {
  return file.arrayBuffer();
}

export function bytesToBlob(bytes, mime) {
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
