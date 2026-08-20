import JSZip from "jszip";
import TurndownService from "turndown";
import { baseName, bytesToBlob } from "../lib/util.js";

export const INPUT_EXTS = ["epub"];
export const OUTPUT_EXTS = ["epub"];
export const READ_TARGETS = ["txt", "md", "html"];

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function writeEpub(html, title) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.folder("META-INF").file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  );
  const oebps = zip.folder("OEBPS");
  const uid = `urn:uuid:${crypto.randomUUID()}`;
  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>zh</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chap1" href="text/chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chap1"/>
  </spine>
</package>`
  );
  oebps.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Nav</title></head>
<body><nav epub:type="toc"><ol><li><a href="text/chapter1.xhtml">${escapeXml(title)}</a></li></ol></nav></body>
</html>`
  );
  oebps.folder("text").file(
    "chapter1.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(title)}</title><meta charset="utf-8"/></head>
<body>${html}</body>
</html>`
  );
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return bytes;
}

export async function convert(file, sourceExt, targetExt) {
  if (targetExt === "epub") {
    return { blob: file, filename: file.name };
  }
  return convertEpubTo(file, targetExt);
}

export async function readEpub(file) {
  const zip = await JSZip.loadAsync(file);
  const containerXml = await zip.file("META-INF/container.xml").async("string");
  const opfPath = /full-path="([^"]+)"/.exec(containerXml)[1];
  const opfXml = await zip.file(opfPath).async("string");
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, "application/xml");
  const manifest = {};
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    manifest[item.getAttribute("id")] = item.getAttribute("href");
  });
  const spineIds = Array.from(opfDoc.querySelectorAll("spine > itemref")).map((n) => n.getAttribute("idref"));
  const titleNode = opfDoc.getElementsByTagName("dc:title")[0] || opfDoc.getElementsByTagName("title")[0];
  const title = titleNode?.textContent || baseName(file.name);

  const htmlParts = [];
  for (const id of spineIds) {
    const href = manifest[id];
    if (!href) continue;
    const entry = zip.file(opfDir + href);
    if (!entry) continue;
    htmlParts.push(await entry.async("string"));
  }
  return { title, htmlParts };
}

function htmlBodyText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body ? doc.body.textContent.trim() : "";
}

export async function convertEpubTo(file, targetExt) {
  const { title, htmlParts } = await readEpub(file);
  const outName = `${baseName(file.name)}.${targetExt}`;
  if (targetExt === "html") {
    const combined = htmlParts.join("\n<hr/>\n");
    return { blob: bytesToBlob(new TextEncoder().encode(combined), "text/html"), filename: outName };
  }
  if (targetExt === "txt") {
    const text = htmlParts.map(htmlBodyText).join("\n\n");
    return { blob: bytesToBlob(new TextEncoder().encode(text), "text/plain"), filename: outName };
  }
  if (targetExt === "md") {
    const turndown = new TurndownService();
    const md = htmlParts.map((h) => turndown.turndown(h)).join("\n\n---\n\n");
    return { blob: bytesToBlob(new TextEncoder().encode(md), "text/markdown"), filename: outName };
  }
  throw new Error(`EPUB 不支援輸出成 ${targetExt}`);
}
