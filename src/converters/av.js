import { baseName, bytesToBlob } from "../lib/util.js";

export const INPUT_EXTS = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "wma", "mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv"];
export const AUDIO_OUTPUT_EXTS = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"];
export const VIDEO_OUTPUT_EXTS = ["mp4", "webm", "mkv", "mov", "gif", "mp3", "wav", "flac", "m4a", "ogg", "aac"];

// Lazy-loaded: ffmpeg.wasm's core (~30MB) is fetched from the jsdelivr CDN on
// first use (same pattern as the official @ffmpeg/ffmpeg examples), not bundled
// into the git repo. Everything runs locally in a Web Worker after that — no
// files are uploaded anywhere. H.265/AV1 encoders are not part of the default
// ffmpeg.wasm core build, so only H.264/VP8/VP9-family containers are offered.
let ffmpegPromise = null;
async function getFfmpeg(onLog) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      if (onLog) ffmpeg.on("log", ({ message }) => onLog(message));
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

export async function convert(file, sourceExt, targetExt, opts = {}) {
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getFfmpeg(opts.onLog);
  const inputName = `input.${sourceExt}`;
  const outputName = `output.${targetExt}`;
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  try {
    await ffmpeg.exec(["-i", inputName, outputName]);
  } catch (err) {
    throw new Error(`轉檔失敗（此瀏覽器的 ffmpeg 核心可能不支援 ${targetExt} 的編碼器）：${err.message || err}`);
  }
  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  const mime = targetExt === "gif" ? "image/gif" : targetExt.startsWith("mp") || ["wav", "flac", "aac", "ogg", "opus"].includes(targetExt) ? "audio/*" : "video/*";
  return { blob: bytesToBlob(data.buffer ? data : new Uint8Array(data), mime), filename: `${baseName(file.name)}.${targetExt}` };
}
