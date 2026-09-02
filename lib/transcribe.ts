import "server-only";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat, chmod, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

// Verbatim transcripts for tracked videos.
//
// ViewTrack only has captions for YouTube, and its Gemini breakdown never
// returns a transcript at all, so this does the work directly: pull the video
// with yt-dlp, hand the file to Gemini, ask for the words. Works on every
// platform yt-dlp supports, which is the point — the swipe file is TikTok and
// Instagram.

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const GEMINI = "https://generativelanguage.googleapis.com";
// A short-form video is a few MB; anything past this is not a Reel and is not
// worth the upload.
const MAX_BYTES = 90 * 1024 * 1024;

export function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

/* -------------------------------- yt-dlp -------------------------------- */

// Railway's Next.js image has no yt-dlp, and adding a system package to the
// builder is a bigger change than this needs. The official static build is a
// single binary, so fetch it once into the container's tmp and reuse it.
const YTDLP_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const YTDLP_PATH = path.join(tmpdir(), "yt-dlp");
let ytdlpReady: Promise<string> | null = null;

async function ensureYtdlp(): Promise<string> {
  // A local dev box almost certainly has it on PATH already.
  for (const candidate of ["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp"]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }
  if (!ytdlpReady) {
    ytdlpReady = (async () => {
      try {
        const s = await stat(YTDLP_PATH);
        if (s.size > 1_000_000) return YTDLP_PATH;
      } catch {
        // not downloaded yet
      }
      const res = await fetch(YTDLP_URL, { redirect: "follow" });
      if (!res.ok || !res.body) {
        throw new Error(`Could not download yt-dlp (${res.status})`);
      }
      await pipeline(
        Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
        createWriteStream(YTDLP_PATH)
      );
      await chmod(YTDLP_PATH, 0o755);
      return YTDLP_PATH;
    })().catch((e) => {
      // Don't cache a failed download — the next call should retry.
      ytdlpReady = null;
      throw e;
    });
  }
  return ytdlpReady;
}

function run(bin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      // Keep only the tail; yt-dlp's progress output is long and useless here.
      stderr = (stderr + d.toString()).slice(-2000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("yt-dlp timed out"));
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.split("\n").filter(Boolean).pop() || `yt-dlp exited ${code}`));
    });
  });
}

/* -------------------------------- Gemini -------------------------------- */

async function uploadToGemini(
  key: string,
  file: Buffer,
  mime: string
): Promise<string> {
  // Resumable protocol rather than multipart: Google's multipart parser treats
  // a JSON metadata Blob as a second file ("Multipart body contains multiple
  // files"), and this path is what their docs use for media anyway.
  const startRes = await fetch(`${GEMINI}/upload/v1beta/files?key=${key}`, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(file.byteLength),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "clip" } }),
  });
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!startRes.ok || !uploadUrl) {
    throw new Error(
      `Gemini upload could not start (${startRes.status}): ${(await startRes.text()).slice(0, 160)}`
    );
  }

  const putRes = await fetch(uploadUrl, {
    method: "POST",
    signal: AbortSignal.timeout(300_000),
    headers: {
      "Content-Length": String(file.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(file),
  });
  const raw = await putRes.text();
  let body: { file?: { uri?: string; name?: string }; error?: { message?: string } };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    throw new Error(`Gemini upload failed (${putRes.status}): ${raw.slice(0, 160)}`);
  }
  if (!putRes.ok || !body.file?.uri) {
    throw new Error(body.error?.message ?? `Gemini upload failed (${putRes.status})`);
  }

  // The file is transcoded server-side; it cannot be referenced until ACTIVE.
  const name = body.file.name;
  for (let i = 0; i < 40; i++) {
    const st = (await fetch(`${GEMINI}/v1beta/${name}?key=${key}`, {
      signal: AbortSignal.timeout(30_000),
    }).then((r) => r.json())) as { state?: string };
    if (st.state === "ACTIVE") return body.file.uri;
    if (st.state === "FAILED") throw new Error("Gemini could not process the video");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Gemini file stayed in PROCESSING");
}

const PROMPT = `Transcribe this video verbatim.

- Write every spoken word exactly as said, in the language spoken.
- Include meaningful on-screen text in brackets, e.g. [on-screen: Secret websites].
- No timestamps, no speaker labels, no commentary, no summary.
- If there is no speech and no text, reply exactly: (no speech)

Output only the transcript.`;

async function askGemini(key: string, fileUri: string, mime: string): Promise<string> {
  let lastErr = "";
  // 503 "high demand" is common on flash models and clears in seconds, so a
  // transcription is not failed until it has been refused three times.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `${GEMINI}/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ fileData: { mimeType: mime, fileUri } }, { text: PROMPT }] },
          ],
        }),
        signal: AbortSignal.timeout(300_000),
      }
    );
    if (res.ok) {
      const d = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
      lastErr = "Gemini returned no text";
    } else {
      lastErr = `Gemini ${res.status}: ${(await res.text()).slice(0, 160)}`;
      if (res.status !== 503 && res.status !== 429) break;
    }
    await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
  }
  throw new Error(lastErr || "Gemini failed");
}

/* ------------------------------ the pipeline ----------------------------- */

function isYouTube(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === "youtube.com" || h === "m.youtube.com" || h === "youtu.be";
  } catch {
    return false;
  }
}

export async function transcribeVideoUrl(url: string): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set on this server");

  const tag = url.slice(-24);
  const log = (stage: string) => console.log(`[transcribe ${tag}] ${stage}`);
  log("start");

  // YouTube never touches yt-dlp: Gemini ingests a YouTube URL natively, so
  // Google does the fetching. That matters on a host like Railway, where
  // YouTube answers our own downloads with "Sign in to confirm you're not a
  // bot" because the IP belongs to a datacenter.
  if (isYouTube(url)) {
    const text = await askGemini(key, url, "video/*");
    log(`transcribed ${text.length} chars (native)`);
    return text;
  }

  const bin = await ensureYtdlp();
  const dir = await mkdtemp(path.join(tmpdir(), "vt-"));
  const out = path.join(dir, "clip.mp4");
  try {
    // TikTok and Instagram rate-limit by IP and start refusing downloads after
    // a handful of pulls ("Your IP address is blocked from accessing this
    // post"). A proxy is the only real fix; set YTDLP_PROXY to one and every
    // download routes through it.
    const proxy = process.env.YTDLP_PROXY?.trim();
    await run(
      bin,
      [
        ...(proxy ? ["--proxy", proxy] : []),
        // Prefer a modest mp4: the audio is what matters and smaller uploads
        // are faster and cheaper than a 1080p master.
        "-f",
        "mp4[filesize<80M]/best[filesize<80M]/mp4/best",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--max-filesize",
        "90M",
        "-o",
        out,
        url,
      ],
      240_000
    );
    const s = await stat(out);
    log(`downloaded ${(s.size / 1e6).toFixed(1)}MB`);
    if (s.size > MAX_BYTES) throw new Error("Video is too large to transcribe");
    const buf = await readFile(out);
    const uri = await uploadToGemini(key, buf, "video/mp4");
    log("uploaded");
    const text = await askGemini(key, uri, "video/mp4");
    log(`transcribed ${text.length} chars`);
    return text;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
