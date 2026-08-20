# Format Transceiver

在瀏覽器裡執行的檔案格式轉換工具。拖檔案進去、選目標格式、下載結果——不用安裝、不用註冊帳號、檔案不會上傳到任何伺服器。整個網站是一個部署在 GitHub Pages 上的純靜態頁面，沒有後端。

## 致謝與授權

本專案的功能發想與支援格式範圍，參考自 [FlyingMouse Format（飞鼠格式）by 牢蜂（LaoFeng）](https://github.com/LaoFeng-mouse/flyingmouse-format) 這款鼠鼠主題的離線 Windows/macOS 轉檔工具，在此致謝原作者。

本專案的技術實作與原專案完全不同：原專案是 Electron 桌面程式，透過 Node.js 呼叫本機安裝的 FFmpeg / LibreOffice / Poppler / Tesseract 等原生程式進行轉檔；本專案改寫成純瀏覽器端（WebAssembly / 純 JS）實作，因此支援的格式範圍與原專案不完全相同（詳見下方支援表）。

原專案採用非商業授權（僅供個人免費使用，禁止商業用途、禁止拿掉作者署名、禁止套殼冒充原創）。本專案比照相同精神：**僅供個人免費、非商業使用**，並在此保留對原作者「牢蜂（LaoFeng）」的署名。

## 支援格式

| 類別 | 輸入 | 輸出 | 說明 |
|---|---|---|---|
| 圖片 | jpg, png, webp, bmp, gif, avif, tif/tiff | png, jpg, webp, bmp, tif/tiff, ico, avif | 純 Canvas/WASM 解碼編碼；AVIF 支援視瀏覽器而定 |
| 文字/資料 | txt, md, html, json, csv, tsv, xml, yaml | txt, md, html, json, csv, xml, yaml, pdf, docx, epub | csv/tsv 另可直接轉成 xlsx |
| 試算表 | xlsx, csv | xlsx, csv, html, json | 僅支援 xlsx（OOXML）與 csv，見下方「已知限制」 |
| Word | docx | html, md, txt, pdf | 僅讀取，輸出為純文字內容，不含版面配置 |
| PDF | pdf | txt, html, docx, png, jpg, zip（逐頁拆分） | 也支援多張圖片合併成 PDF、多個 PDF 合併 |
| 電子書 | epub | txt, md, html | 任何文字/HTML 也可以轉成 epub |
| 音訊/視訊 | mp3, wav, flac, m4a, aac, ogg, opus, wma, mp4, mov, mkv, webm, avi, m4v, wmv, flv | mp3, wav, flac, m4a, aac, ogg, opus, mp4, webm, mkv, mov, gif | 透過 ffmpeg.wasm，僅 H.264/VP8/VP9 等內建於預設核心的編碼器 |
| OCR | 圖片, PDF（掃描版） | txt | 透過 tesseract.js，支援英文、簡體中文 |
| 壓縮 | 任意檔案 | zip | 可打包任意檔案，也可解壓縮 zip 內容 |

## 已知限制

- **不支援**：舊版 doc / wps / wpt / wpd / odt / rtf、PPT 系列（ppt/pptx/odp/dps/dpt）、相機 RAW（CR2/NEF/ARW 等）、AVS3 視訊編碼。這些格式在原專案中是靠本機安裝的 LibreOffice、AVS3 解碼器等原生程式處理，瀏覽器端沒有可靠、夠輕量的對應方案，因此本專案沒有實作，而不是實作了但沒測試。
- **xls / ods 讀取目前未支援**：唯一成熟的純 JS 讀取函式庫（npm 上的 `xlsx` / SheetJS）停留在有已知高風險漏洞（原型污染、ReDoS）的 0.18.5 版本，修補後的版本只發布在 SheetJS 自家 CDN。既然這個網站的功能就是解析使用者丟進來、來源不明的檔案，不會因為省事就吃下一個已知有漏洞的解析器，因此暫時只支援 xlsx/csv（透過 `exceljs`）。
- **PDF → Word/文字輸出僅保留純文字**，不會還原版面、表格、圖片位置。
- **H.265 / AV1 未提供**：ffmpeg.wasm 預設核心不包含這兩種編碼器（授權/體積考量），只提供 H.264 / VP8 / VP9 家族。
- **文字轉 PDF 用點陣渲染**：為了讓中日韓等任何語言都能正確顯示（而不是踩到 PDF 函式庫內建字型無法編碼非拉丁字元而直接壞掉），文字轉 PDF 是先在 canvas 上用瀏覽器字型畫出來、再輸出成圖片頁，因此輸出的 PDF 文字不可反白選取。
- **外部 CDN 依賴（僅 OCR 與音訊/視訊功能）**：`tesseract.js`（OCR 語言檔）與 `@ffmpeg/core`（音訊/視訊轉檔核心）在第一次使用時，會從 jsdelivr 這類公開 CDN 下載對應的 WASM 檔案（數十 MB），而不是打包進這個 repo。除了這兩項，其餘所有功能與資源都直接由 GitHub Pages 提供，網站本身不依賴任何自己維護的伺服器。

## 本機開發

```bash
npm install
npm run dev       # 開發伺服器
npm run build     # 輸出到 dist/
npm run preview   # 預覽 build 結果
```

## 部署

`main` 分支的 push 會觸發 `.github/workflows/deploy.yml`，自動 build 並發布到 GitHub Pages（需要先在 repo 的 Settings → Pages 把來源設定成 GitHub Actions）。
