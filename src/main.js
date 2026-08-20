import "./style.css";
import { extOf, baseName, download, formatBytes } from "./lib/util.js";
import { targetsForExt, isKnownInputExt, OCR_IMAGE_EXTS } from "./matrix.js";
import { convertFile, mergePdfs, imagesToPdf, filesToZip, listZipEntries, extractZipEntry } from "./registry.js";

const app = document.getElementById("app");
app.innerHTML = `
  <header class="topbar">
    <h1>Format Transceiver</h1>
    <p class="tagline">檔案格式轉換，完全在你的瀏覽器裡執行 — 不上傳、不需要安裝、不需要伺服器。</p>
  </header>

  <main>
    <div id="dropzone" class="dropzone">
      <p>拖曳檔案到這裡，或點擊選擇檔案</p>
      <input id="fileInput" type="file" multiple hidden />
    </div>

    <div id="toolbar" class="toolbar" hidden>
      <button id="convertAllBtn" class="primary">全部轉換</button>
      <button id="mergeImagesBtn" hidden>合併圖片為 PDF</button>
      <button id="mergePdfBtn" hidden>合併 PDF</button>
      <button id="zipAllBtn">打包成 ZIP</button>
      <button id="clearBtn" class="ghost">清空</button>
    </div>

    <ul id="fileList" class="file-list"></ul>
    <div id="zipViewer" class="zip-viewer" hidden></div>
  </main>

  <footer class="footer">
    <p>
      本專案為個人非商業用途之衍生開發，介面與轉檔邏輯改寫為純瀏覽器端實作。
      功能發想與部分格式支援範圍參考自
      <a href="https://github.com/LaoFeng-mouse/flyingmouse-format" target="_blank" rel="noopener">FlyingMouse Format（飞鼠格式）by 牢蜂 LaoFeng</a>，
      在此致謝原作者；本專案與原作者的授權條款一致，僅供個人免費、非商業使用。
    </p>
    <p><a href="https://github.com/nickwhat/format_transceiver" target="_blank" rel="noopener">原始碼 / Source</a></p>
  </footer>
`;

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileListEl = document.getElementById("fileList");
const toolbar = document.getElementById("toolbar");
const zipViewer = document.getElementById("zipViewer");

let items = [];
let idSeq = 0;

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

function addFiles(fileList) {
  const files = Array.from(fileList);
  if (files.length === 1 && extOf(files[0].name) === "zip") {
    openZipViewer(files[0]);
    return;
  }
  zipViewer.hidden = true;
  for (const file of files) {
    const ext = extOf(file.name);
    const targets = targetsForExt(ext);
    items.push({
      id: idSeq++,
      file,
      ext,
      targets,
      targetKey: targets[0] ? `${targets[0].module}::${targets[0].ext}` : "",
      status: isKnownInputExt(ext) ? "idle" : "unsupported",
      resultBlob: null,
      resultName: null,
      error: null,
      progress: ""
    });
  }
  render();
}

function removeItem(id) {
  items = items.filter((it) => it.id !== id);
  render();
}

async function convertOne(it) {
  if (!it.targetKey) return;
  const [module, ext] = it.targetKey.split("::");
  it.status = "working";
  it.progress = "";
  render();
  try {
    const opts = {};
    if (module === "ocr" || module === "ocr-pdf") opts.lang = it.ocrLang || "eng";
    opts.onProgress = (frac, msg) => { it.progress = msg || `${Math.round(frac * 100)}%`; render(); };
    const { blob, filename } = await convertFile(it.file, it.ext, ext, module, opts);
    it.resultBlob = blob;
    it.resultName = filename;
    it.status = "done";
  } catch (err) {
    console.error(err);
    it.error = err.message || String(err);
    it.status = "error";
  }
  render();
}

document.getElementById("convertAllBtn").addEventListener("click", async () => {
  for (const it of items) {
    if (it.status !== "unsupported" && it.targetKey) await convertOne(it);
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  items = [];
  zipViewer.hidden = true;
  render();
});

document.getElementById("zipAllBtn").addEventListener("click", async () => {
  if (items.length === 0) return;
  const { blob, filename } = await filesToZip(items.map((it) => it.file), "archive.zip");
  download(blob, filename);
});

document.getElementById("mergeImagesBtn").addEventListener("click", async () => {
  const { blob, filename } = await imagesToPdf(items.map((it) => it.file));
  download(blob, filename);
});

document.getElementById("mergePdfBtn").addEventListener("click", async () => {
  const { blob, filename } = await mergePdfs(items.map((it) => it.file));
  download(blob, filename);
});

async function openZipViewer(file) {
  zipViewer.hidden = false;
  zipViewer.innerHTML = "<p>讀取 ZIP 內容中…</p>";
  const { zip, entries } = await listZipEntries(file);
  zipViewer.innerHTML = `
    <h3>${file.name}（${entries.length} 個項目）</h3>
    <ul>
      ${entries.map((e) => `<li><span>${e.name}</span><small>${formatBytes(e.size)}</small><button data-entry="${e.name}">下載</button></li>`).join("")}
    </ul>
    <button id="extractAllBtn">全部下載</button>
    <button id="closeZipBtn" class="ghost">關閉</button>
  `;
  zipViewer.querySelectorAll("button[data-entry]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const blob = await extractZipEntry(zip, btn.dataset.entry);
      download(blob, btn.dataset.entry.split("/").pop());
    });
  });
  document.getElementById("extractAllBtn").addEventListener("click", async () => {
    for (const e of entries) {
      const blob = await extractZipEntry(zip, e.name);
      download(blob, e.name.split("/").pop());
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  document.getElementById("closeZipBtn").addEventListener("click", () => {
    zipViewer.hidden = true;
    zipViewer.innerHTML = "";
  });
}

function render() {
  toolbar.hidden = items.length === 0;
  const allImages = items.length >= 2 && items.every((it) => OCR_IMAGE_EXTS.includes(it.ext));
  const allPdf = items.length >= 2 && items.every((it) => it.ext === "pdf");
  document.getElementById("mergeImagesBtn").hidden = !allImages;
  document.getElementById("mergePdfBtn").hidden = !allPdf;

  fileListEl.innerHTML = items
    .map((it) => {
      if (it.status === "unsupported") {
        return `<li class="file-item unsupported">
          <div class="meta"><strong>${it.file.name}</strong><small>${formatBytes(it.file.size)} · 目前不支援 .${it.ext} 作為來源格式</small></div>
          <button data-remove="${it.id}" class="ghost">移除</button>
        </li>`;
      }
      const options = it.targets
        .map((t) => `<option value="${t.module}::${t.ext}" ${it.targetKey === `${t.module}::${t.ext}` ? "selected" : ""}>${t.label}</option>`)
        .join("");
      const ocrLangPicker = (it.targetKey.startsWith("ocr")) ? `
        <select data-ocrlang="${it.id}">
          <option value="eng" ${it.ocrLang !== "chi_sim" ? "selected" : ""}>英文</option>
          <option value="chi_sim" ${it.ocrLang === "chi_sim" ? "selected" : ""}>簡體中文</option>
        </select>` : "";
      let statusHtml = "";
      if (it.status === "working") statusHtml = `<span class="badge working">轉換中… ${it.progress}</span>`;
      else if (it.status === "done") statusHtml = `<button data-download="${it.id}" class="primary">下載 ${it.resultName}</button>`;
      else if (it.status === "error") statusHtml = `<span class="badge error" title="${it.error}">失敗：${it.error}</span>`;

      return `<li class="file-item">
        <div class="meta"><strong>${it.file.name}</strong><small>${formatBytes(it.file.size)}</small></div>
        <select data-target="${it.id}">${options}</select>
        ${ocrLangPicker}
        <button data-convert="${it.id}">轉換</button>
        ${statusHtml}
        <button data-remove="${it.id}" class="ghost">移除</button>
      </li>`;
    })
    .join("");

  fileListEl.querySelectorAll("[data-remove]").forEach((btn) => btn.addEventListener("click", () => removeItem(Number(btn.dataset.remove))));
  fileListEl.querySelectorAll("[data-target]").forEach((sel) =>
    sel.addEventListener("change", () => {
      const it = items.find((i) => i.id === Number(sel.dataset.target));
      it.targetKey = sel.value;
      it.status = "idle";
      render();
    })
  );
  fileListEl.querySelectorAll("[data-ocrlang]").forEach((sel) =>
    sel.addEventListener("change", () => {
      const it = items.find((i) => i.id === Number(sel.dataset.ocrlang));
      it.ocrLang = sel.value;
    })
  );
  fileListEl.querySelectorAll("[data-convert]").forEach((btn) =>
    btn.addEventListener("click", () => convertOne(items.find((i) => i.id === Number(btn.dataset.convert))))
  );
  fileListEl.querySelectorAll("[data-download]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const it = items.find((i) => i.id === Number(btn.dataset.download));
      download(it.resultBlob, it.resultName);
    })
  );
}

render();
