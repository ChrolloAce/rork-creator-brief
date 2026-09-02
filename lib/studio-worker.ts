import "server-only";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import {
  claimNextStudioRender,
  createImage,
  getCuration,
  getImage,
  getStudioClipBlobId,
  reclaimStaleStudioJobs,
  updateStudioClip,
  updateStudioRender,
} from "./db";
import { normalizeClip, posterFrame, probe, renderConcat, renderStitch, renderPip, videoDurationSec } from "./studio-ffmpeg";
import { getHookVideo } from "./hook-videos";
import { renderTextCard } from "./studio-text";
import {
  STUDIO_DEFAULTS,
  effectiveLibraryHookSec,
  effectiveTimings,
  slugifyForFile,
  type StudioClipKind,
  type StudioRender,
  pipSettings,
} from "./studio";

// Background work for the Video Builder: normalizing uploads and stitching
// renders. Runs inside the Next.js process (no separate worker), the same way
// the transcript queue does. ffmpeg is CPU-bound, so a small slot count keeps
// five simultaneous uploads from starving the web server.

declare global {
  var __studioSlots: { active: number; waiters: (() => void)[] } | undefined;
  var __studioDraining: boolean | undefined;
  var __studioReclaimed: boolean | undefined;
}

const MAX_FFMPEG = 2;

function slots() {
  if (!globalThis.__studioSlots) globalThis.__studioSlots = { active: 0, waiters: [] };
  return globalThis.__studioSlots;
}

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  const s = slots();
  if (s.active >= MAX_FFMPEG) {
    await new Promise<void>((resolve) => s.waiters.push(resolve));
  }
  s.active++;
  try {
    return await fn();
  } finally {
    s.active--;
    s.waiters.shift()?.();
  }
}

function log(tag: string, msg: string) {
  console.log(`[studio ${tag}] ${msg}`);
}

/* ------------------------------- uploads -------------------------------- */

// Stream a request body to disk, counting bytes so an oversize upload is cut
// off instead of buffered. Returns the path.
export async function spoolUpload(
  body: ReadableStream<Uint8Array>,
  ext: string,
  maxBytes: number
): Promise<{ dir: string; file: string; bytes: number }> {
  const dir = await mkdtemp(path.join(tmpdir(), "studio-up-"));
  const file = path.join(dir, `raw${ext}`);
  let bytes = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytes += chunk.length;
      if (bytes > maxBytes) cb(new Error("too large"));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]),
      counter,
      createWriteStream(file)
    );
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw e;
  }
  return { dir, file, bytes };
}

// Normalize a spooled upload into the house mp4 + poster and store both.
// Owns the temp dir: it is removed whatever happens.
export async function ingestClip(input: {
  clipId: string;
  kind: StudioClipKind;
  dir: string;
  file: string;
  filename: string | null;
}): Promise<void> {
  const { clipId, dir, file } = input;
  try {
    await withSlot(async () => {
      const info = await probe(file);
      if (!info.hasVideo) throw new Error("That file does not look like a video.");
      if (info.durationSec < 0.5) throw new Error("That clip is too short.");
      const out = path.join(dir, "norm.mp4");
      const poster = path.join(dir, "poster.jpg");
      await normalizeClip({
        src: file,
        out,
        maxSec: input.kind === "broll" ? STUDIO_DEFAULTS.maxBrollSec : STUDIO_DEFAULTS.maxDemoSec,
        hasAudio: info.hasAudio,
        hdr: info.hdr,
        mode: input.kind === "broll" ? "cover" : "fit",
      });
      if (info.hdr) log(clipId, "HDR source tone mapped to BT.709");
      await posterFrame(out, poster);
      const normalized = await probe(out);
      const [mp4, jpg] = await Promise.all([readFile(out), readFile(poster)]);
      const base = slugifyForFile(
        (input.filename ?? "").replace(/\.[a-z0-9]+$/i, "") || input.kind
      );
      const { id: blobId } = await createImage("video/mp4", mp4, `${base}.mp4`);
      const { id: posterId } = await createImage("image/jpeg", jpg, `${base}.jpg`);
      await updateStudioClip(clipId, {
        status: "ready",
        error: null,
        blobId,
        posterId,
        durationSec: Math.round(normalized.durationSec * 10) / 10,
        width: normalized.width,
        height: normalized.height,
        sizeBytes: mp4.length,
      });
      log(clipId, `ready ${(mp4.length / 1e6).toFixed(1)}MB ${normalized.durationSec.toFixed(1)}s`);
    });
  } catch (e) {
    const msg = (e as Error).message || "Could not process the video.";
    log(clipId, `error: ${msg}`);
    await updateStudioClip(clipId, { status: "error", error: msg.slice(0, 300) }).catch(() => {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/* ------------------------------- renders -------------------------------- */

async function blobToFile(blobId: string, file: string): Promise<void> {
  const img = await getImage(blobId);
  if (!img) throw new Error("A source clip is missing. Upload it again.");
  await writeFile(file, img.bytes);
}

// Library opening: the first N seconds of a hook_video reel, normalized to the
// house format, then the demo. No cards, no background loop.
async function runLibraryRender(job: StudioRender, dir: string): Promise<{ out: string }> {
  if (!job.demoId || !job.hookVideoId) throw new Error("Pick a demo and a hook reel.");
  const [demoBlob, reel, cur] = await Promise.all([
    getStudioClipBlobId(job.demoId),
    getHookVideo(job.hookVideoId),
    getCuration(job.briefSlug),
  ]);
  if (!demoBlob) throw new Error("That demo is gone. Upload it again.");
  if (!reel) throw new Error("That hook reel is gone. Try again.");
  const demo = path.join(dir, "demo.mp4");
  const raw = path.join(dir, "reel-raw.mp4");
  const res = await fetch(reel.videoUrl);
  if (!res.ok) throw new Error("Could not fetch the hook reel.");
  await Promise.all([
    blobToFile(demoBlob, demo),
    writeFile(raw, Buffer.from(await res.arrayBuffer())),
  ]);
  const info = await probe(raw);
  if (!info.hasVideo) throw new Error("The hook reel is not a video.");
  const hook = path.join(dir, "reel.mp4");
  const hookSec = effectiveLibraryHookSec(cur.studio);
  const pip = pipSettings(cur.studio);
  const out = path.join(dir, "out.mp4");
  // Demos normalized before the HDR fix still carry bt2020/HLG tags on
  // 8-bit pixels; tone mapping them here at render time corrects those too.
  const demoInfo = await probe(demo);
  if (pip.transition === "pip") {
    // The reel keeps playing in the corner, so keep it as long as the demo.
    await normalizeClip({
      src: raw,
      out: hook,
      maxSec: Math.min(STUDIO_DEFAULTS.maxDemoSec + hookSec, hookSec + demoInfo.durationSec + 1),
      hasAudio: info.hasAudio,
      hdr: info.hdr,
      mode: "cover",
    });
    await renderPip({
      reel: hook,
      demo,
      demoHdr: demoInfo.hdr,
      hookSec,
      animSec: pip.animSec,
      scale: pip.scale,
      corner: pip.corner,
      margin: pip.margin,
      out,
    });
    // The picture must run for the hook plus the whole demo. A short video
    // track with full-length audio is exactly the failure this guards.
    const expected = hookSec + demoInfo.durationSec;
    const vsec = await videoDurationSec(out);
    if (vsec < expected - 1.5) {
      throw new Error(
        `Handover render came out short: ${vsec.toFixed(1)}s of picture for ${expected.toFixed(1)}s.`
      );
    }
    log(job.id, `handover ok: ${vsec.toFixed(1)}s picture, hook ${hookSec}s, demo ${demoInfo.durationSec.toFixed(1)}s`);
    return { out };
  }
  await normalizeClip({
    src: raw,
    out: hook,
    maxSec: hookSec,
    hasAudio: info.hasAudio,
    hdr: info.hdr,
    mode: "cover",
  });
  await renderConcat({ first: hook, second: demo, secondHdr: demoInfo.hdr, out });
  return { out };
}

async function runRender(job: StudioRender): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "studio-rn-"));
  try {
    await withSlot(async () => {
      if (job.hookVideoId) {
        const { out } = await runLibraryRender(job, dir);
        await finishRender(job, dir, out);
        return;
      }
      if (!job.demoId || !job.brollId) throw new Error("Pick a demo and a background clip.");
      const [demoBlob, brollBlob, cur] = await Promise.all([
        getStudioClipBlobId(job.demoId),
        getStudioClipBlobId(job.brollId),
        getCuration(job.briefSlug),
      ]);
      if (!demoBlob) throw new Error("That demo is gone. Upload it again.");
      if (!brollBlob) throw new Error("That background clip is gone. Pick another.");
      const demo = path.join(dir, "demo.mp4");
      const broll = path.join(dir, "broll.mp4");
      await Promise.all([blobToFile(demoBlob, demo), blobToFile(brollBlob, broll)]);
      const [brollInfo, demoInfo2] = await Promise.all([probe(broll), probe(demo)]);
      const cfg = cur.studio;
      const { hookSec, explanationSec } = effectiveTimings(cfg, job.explanationText);
      const style = cfg?.textStyle ?? STUDIO_DEFAULTS.textStyle;
      const hookPng = path.join(dir, "hook.png");
      const explPng = path.join(dir, "expl.png");
      await writeFile(hookPng, await renderTextCard(job.hookText, { tone: "hook", style }));
      await writeFile(
        explPng,
        await renderTextCard(job.explanationText, { tone: "explanation", style })
      );
      const out = path.join(dir, "out.mp4");
      await renderStitch({
        broll,
        brollHasAudio: brollInfo.hasAudio,
        brollHdr: brollInfo.hdr,
        demo,
        demoHdr: demoInfo2.hdr,
        hookPng,
        explanationPng: explPng,
        hookSec,
        explanationSec,
        out,
      });
      await finishRender(job, dir, out);
    });
  } catch (e) {
    const msg = (e as Error).message || "Render failed.";
    log(job.id, `error: ${msg}`);
    await updateStudioRender(job.id, { status: "error", error: msg.slice(0, 300) }).catch(() => {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Poster + store + mark ready. Shared by both openings.
async function finishRender(job: StudioRender, dir: string, out: string): Promise<void> {
  const poster = path.join(dir, "poster.jpg");
  await posterFrame(out, poster, 0.5);
  const info = await probe(out);
  const [mp4, jpg] = await Promise.all([readFile(out), readFile(poster)]);
  const base = `${slugifyForFile(job.briefSlug, 20)}-${slugifyForFile(job.hookText, 36)}`;
  const { id: blobId } = await createImage("video/mp4", mp4, `${base}.mp4`);
  const { id: posterId } = await createImage("image/jpeg", jpg, `${base}.jpg`);
  await updateStudioRender(job.id, {
    status: "ready",
    error: null,
    blobId,
    posterId,
    durationSec: Math.round(info.durationSec * 10) / 10,
    sizeBytes: mp4.length,
  });
  const s = await stat(out);
  log(job.id, `ready ${(s.size / 1e6).toFixed(1)}MB ${info.durationSec.toFixed(1)}s`);
}

// Drain the queue. Safe to call from anywhere, any number of times: only one
// drain loop runs per process, and it exits when nothing is queued.
export function kickStudioQueue(): void {
  if (globalThis.__studioDraining) return;
  globalThis.__studioDraining = true;
  void (async () => {
    try {
      if (!globalThis.__studioReclaimed) {
        globalThis.__studioReclaimed = true;
        await reclaimStaleStudioJobs().catch(() => {});
      }
      for (;;) {
        const job = await claimNextStudioRender();
        if (!job) break;
        await runRender(job);
      }
    } catch (e) {
      console.error("[studio] queue loop failed:", (e as Error).message);
    } finally {
      globalThis.__studioDraining = false;
    }
  })();
}
