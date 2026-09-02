import "server-only";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import ffmpegStatic from "ffmpeg-static";

// Thin ffmpeg layer for the Video Builder. One binary (ffmpeg-static, with a
// PATH fallback for dev boxes), a stderr-parsing probe so we do not need
// ffprobe too, and the three commands the builder runs: normalize an upload,
// grab a poster frame, stitch a render.

const OUT_W = 1080;
const OUT_H = 1920;
const FPS = 30;

let resolved: Promise<string> | null = null;

export function ffmpegBin(): Promise<string> {
  if (!resolved) {
    resolved = (async () => {
      const candidates = [
        ffmpegStatic ?? "",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
      ].filter(Boolean);
      for (const c of candidates) {
        try {
          await access(c);
          return c;
        } catch {
          // keep looking
        }
      }
      // Last resort: whatever `ffmpeg` resolves to on PATH.
      return "ffmpeg";
    })();
  }
  return resolved;
}

export function runFfmpeg(args: string[], timeoutMs = 10 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    void ffmpegBin().then((bin) => {
      const child = spawn(bin, ["-hide_banner", "-nostdin", ...args], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      const collect = (d: Buffer) => {
        // ffmpeg's progress lines are long and repetitive; keep the tail.
        stderr = (stderr + d.toString()).slice(-60000);
      };
      child.stderr.on("data", collect);
      child.stdout.on("data", collect);
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("ffmpeg timed out"));
      }, timeoutMs);
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stderr);
        else {
          const lines = stderr.split("\n").map((l) => l.trim()).filter(Boolean);
          // The useful error is usually the last non-progress line.
          const msg =
            [...lines].reverse().find((l) => !/^(frame=|size=|video:)/.test(l)) ||
            `ffmpeg exited ${code}`;
          reject(new Error(msg.slice(0, 300)));
        }
      });
    }, reject);
  });
}

export type ProbeInfo = {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasVideo: boolean;
  // BT.2020 / HLG / PQ source (phones record HDR by default). Must be tone
  // mapped to BT.709, or the 8-bit output comes out oversaturated and every
  // later stage inherits the wrong color tags.
  hdr: boolean;
};

// `ffmpeg -i file` with no output exits non-zero but prints the stream table
// we want. Rotation metadata swaps the reported dimensions because ffmpeg
// autorotates on decode, so a portrait phone clip stored as landscape+rotate
// comes out portrait, which is what every later step sees.
export async function probe(file: string): Promise<ProbeInfo> {
  let out = "";
  try {
    out = await runFfmpeg(["-i", file], 60_000);
  } catch (e) {
    out = (e as Error).message;
    // runFfmpeg only hands back the last line on failure; re-run capturing
    // everything via a null muxer instead, which exits 0.
  }
  if (!/Stream #/.test(out)) {
    out = await runFfmpeg(["-i", file, "-t", "0.1", "-f", "null", "-"], 60_000).catch(
      (e) => (e as Error).message
    );
  }
  const dur = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationSec = dur
    ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3])
    : 0;
  const video = out.match(/Video:[^\n]*?[,\s](\d{2,5})x(\d{2,5})[\s,\[]/);
  let width = video ? Number(video[1]) : 0;
  let height = video ? Number(video[2]) : 0;
  const rot = out.match(/rotation of (-?\d+(?:\.\d+)?) degrees|rotate\s*:\s*(-?\d+)/);
  const deg = rot ? Math.abs(Number(rot[1] ?? rot[2])) % 180 : 0;
  if (deg === 90) [width, height] = [height, width];
  const videoLine = out.match(/Stream #\d+:\d+[^\n]*Video:[^\n]*/)?.[0] ?? "";
  return {
    durationSec,
    width,
    height,
    hasVideo: !!video,
    hasAudio: /Stream #\d+:\d+[^\n]*Audio:/.test(out),
    hdr: /bt2020|smpte2084|arib-std-b67/i.test(videoLine),
  };
}

// HDR → SDR. Linear light, BT.709 primaries, Hable tone curve, back to
// BT.709 TV range. Needs libzimg (zscale); ffmpeg-static ships it on macOS
// and Linux, but check once so a build without it degrades to a plain
// conversion instead of failing every render.
const TONEMAP =
  "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
let zscaleReady: Promise<boolean> | null = null;
async function hasZscale(): Promise<boolean> {
  if (!zscaleReady) {
    zscaleReady = runFfmpeg(["-filters"], 60_000)
      .then((o) => / zscale /.test(o))
      .catch(() => false)
      .then((ok) => {
        if (!ok) console.warn("[studio] ffmpeg has no zscale filter; HDR sources will not be tone mapped");
        return ok;
      });
  }
  return zscaleReady;
}
// Filter prefix for an input chain: tone map when the source is HDR.
async function hdrPrefix(hdr: boolean | undefined): Promise<string> {
  return hdr && (await hasZscale()) ? TONEMAP + "," : "";
}

// Duration of the VIDEO track. The container "Duration:" line is the longest
// stream, so a file whose picture stops early but whose audio runs on still
// reports the full length; decoding only the video and reading the final
// progress timestamp is the honest number.
export async function videoDurationSec(file: string): Promise<number> {
  const out = await runFfmpeg(
    ["-i", file, "-map", "0:v:0", "-an", "-f", "null", "-"],
    5 * 60_000
  ).catch((e) => (e as Error).message);
  const times = Array.from(out.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g));
  const last = times[times.length - 1];
  if (!last) return 0;
  return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
}

// Blurred-fill cover: the clip is scaled to fit inside 1080x1920 and sits on
// a blurred, cropped copy of itself, so a 16:9 screen recording does not get
// black bars and a 9:16 phone clip covers the frame edge to edge.
//
// NOTE: filter strings here are plain strings joined with arrays, never
// template literals glued with `+`. The production bundler (Turbopack/SWC)
// constant-folds that pattern and silently dropped the tail of one literal
// (the boxblur stage), which only surfaced in the built server.
const SIZE = OUT_W + ":" + OUT_H;
const COVER = "scale=" + SIZE + ":force_original_aspect_ratio=increase,crop=" + SIZE;
const FIT_FILL = [
  "split=2[bg][fg]",
  "[bg]" + COVER + ",boxblur=luma_radius=40:luma_power=2:chroma_radius=20:chroma_power=2[bgb]",
  "[fg]scale=" + SIZE + ":force_original_aspect_ratio=decrease[fgs]",
  "[bgb][fgs]overlay=(W-w)/2:(H-h)/2",
].join(";");

const X264 = [
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-profile:v", "high",
  "-pix_fmt", "yuv420p",
  // Every output is SDR BT.709 TV range, and says so. Without these tags an
  // HDR input's bt2020 metadata rides through concat/overlay onto the whole
  // file and players render the SDR parts with the wrong matrix.
  "-color_primaries", "bt709",
  "-color_trc", "bt709",
  "-colorspace", "bt709",
  "-color_range", "tv",
  "-movflags", "+faststart",
];
const AAC = ["-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k"];

// Normalize any upload into the house format: 1080x1920, 30fps, H.264 + AAC
// stereo (silent track added when the source has none, so later concats
// always have an audio stream to line up), capped at maxSec.
export async function normalizeClip(input: {
  src: string;
  out: string;
  maxSec: number;
  hasAudio: boolean;
  hdr?: boolean;
  // "cover" crops to fill (background clips), "fit" keeps everything with a
  // blurred fill (demos, where the content matters).
  mode: "cover" | "fit";
}): Promise<void> {
  const vf = input.mode === "cover" ? COVER : FIT_FILL;
  const filter = "[0:v]" + (await hdrPrefix(input.hdr)) + vf + ",fps=" + FPS + ",format=yuv420p,setsar=1[v]";
  const args = [
    "-y",
    "-i", input.src,
    ...(input.hasAudio ? [] : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]),
    "-t", String(input.maxSec),
    "-filter_complex", filter,
    "-map", "[v]",
    "-map", input.hasAudio ? "0:a:0" : "1:a",
    ...(input.hasAudio ? [] : ["-shortest"]),
    ...X264,
    "-crf", "24",
    ...AAC,
    "-max_muxing_queue_size", "1024",
    input.out,
  ];
  await runFfmpeg(args);
}

export async function posterFrame(src: string, out: string, atSec = 0.3): Promise<void> {
  await runFfmpeg([
    "-y",
    "-ss", String(atSec),
    "-i", src,
    "-frames:v", "1",
    "-vf", "scale=540:-2",
    "-q:v", "5",
    out,
  ], 60_000);
}

// The stitch. Background clip (looped if short) carries the hook card, then
// the explanation card, then a hard cut to the creator's demo. Both cards are
// pre-rendered PNGs with alpha (lib/studio-text.tsx) so the type is real
// typography rather than ffmpeg drawtext.
export async function renderStitch(input: {
  broll: string;
  brollHasAudio: boolean;
  brollHdr?: boolean;
  demo: string;
  demoHdr?: boolean;
  hookPng: string;
  explanationPng: string;
  hookSec: number;
  explanationSec: number;
  out: string;
}): Promise<void> {
  const total = input.hookSec + input.explanationSec;
  const bgAudioIdx = input.brollHasAudio ? "0:a" : "4:a";
  const filter = [
    "[0:v]" + (await hdrPrefix(input.brollHdr)) + COVER + ",fps=" + FPS + ",setsar=1,trim=duration=" + total + ",setpts=PTS-STARTPTS[bg]",
    "[bg][2:v]overlay=0:0:enable='lt(t," + input.hookSec + ")'[bg1]",
    "[bg1][3:v]overlay=0:0:enable='gte(t," + input.hookSec + ")',format=yuv420p[v0]",
    "[" + bgAudioIdx + "]aresample=44100,atrim=duration=" + total + ",asetpts=PTS-STARTPTS[a0]",
    "[1:v]" + (await hdrPrefix(input.demoHdr)) + "fps=" + FPS + ",setsar=1,setpts=PTS-STARTPTS[v1]",
    "[1:a]aresample=44100,asetpts=PTS-STARTPTS[a1]",
    "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
  ].join(";");
  const args = [
    "-y",
    // -t as an INPUT option bounds how much of the looped background is read,
    // otherwise the infinite loop never lets the concat finish.
    "-stream_loop", "-1", "-t", String(total + 0.5), "-i", input.broll,
    "-i", input.demo,
    "-i", input.hookPng,
    "-i", input.explanationPng,
    "-f", "lavfi", "-t", String(total + 0.5), "-i", "anullsrc=r=44100:cl=stereo",
    "-filter_complex", filter,
    "-map", "[v]",
    "-map", "[a]",
    ...X264,
    "-crf", "23",
    ...AAC,
    "-max_muxing_queue_size", "1024",
    input.out,
  ];
  await runFfmpeg(args);
}

// Join two already-normalized clips (same size, fps, stereo AAC) back to back:
// used by the library opening, where the first N seconds of a reel cut
// straight into the demo with no cards.
export async function renderConcat(input: {
  first: string;
  second: string;
  firstHdr?: boolean;
  secondHdr?: boolean;
  out: string;
}): Promise<void> {
  const filter = [
    "[0:v]" + (await hdrPrefix(input.firstHdr)) + "fps=" + FPS + ",setsar=1,setpts=PTS-STARTPTS[v0]",
    "[0:a]aresample=44100,asetpts=PTS-STARTPTS[a0]",
    "[1:v]" + (await hdrPrefix(input.secondHdr)) + "fps=" + FPS + ",setsar=1,setpts=PTS-STARTPTS[v1]",
    "[1:a]aresample=44100,asetpts=PTS-STARTPTS[a1]",
    "[v0][a0][v1][a1]concat=n=2:v=1:a=1,format=yuv420p[v][a]",
  ].join(";");
  await runFfmpeg([
    "-y",
    "-i", input.first,
    "-i", input.second,
    "-filter_complex", filter.replace(",format=yuv420p[v][a]", "[v][a]"),
    "-map", "[v]",
    "-map", "[a]",
    ...X264,
    "-crf", "23",
    ...AAC,
    "-max_muxing_queue_size", "1024",
    input.out,
  ]);
}

// Hook reel → demo with a picture-in-picture handover instead of a cut. The
// demo is the base layer, delayed by hookSec behind black. The reel sits on
// top: full frame until hookSec, then over animSec it scales down (per-frame
// expressions on scale + overlay) into a corner and keeps playing there,
// muted, until it ends or the demo ends. Audio: reel for the hook, then the
// demo.
export async function renderPip(input: {
  reel: string;
  reelHdr?: boolean;
  demo: string;
  demoHdr?: boolean;
  hookSec: number;
  animSec: number;
  scale: number;
  corner: "bottom-left" | "top-left" | "bottom-right" | "top-right";
  margin: number;
  out: string;
}): Promise<void> {
  const h0 = input.hookSec.toFixed(3);
  const a = Math.max(0.1, input.animSec).toFixed(3);
  const shrink = (1 - input.scale).toFixed(4);
  // 0 → 1 over the animation window, eased out so the shrink lands softly.
  const lin = "clip((t-" + h0 + ")/" + a + ",0,1)";
  const p = "(1-(1-" + lin + ")*(1-" + lin + "))";
  const w = "2*trunc(" + OUT_W + "*(1-" + shrink + "*" + p + ")/2)";
  const hh = "2*trunc(" + OUT_H + "*(1-" + shrink + "*" + p + ")/2)";
  const m = String(input.margin);
  // overlay expressions: W/H = main size, w/h = overlay size, t = time.
  const left = input.corner.endsWith("left");
  const top = input.corner.startsWith("top");
  const x = left ? m + "*" + p : "(W-w-" + m + ")*" + p;
  const y = top ? m + "*" + p : "(H-h-" + m + ")*" + p;
  // Base = hookSec of black, then the demo, built with color+concat rather
  // than tpad (which produced a demo-length track on the Linux build).
  const filter = [
    "color=c=black:s=" + OUT_W + "x" + OUT_H + ":r=" + FPS + ":d=" + h0 + ",format=yuv420p[blk]",
    "[1:v]" + (await hdrPrefix(input.demoHdr)) + "fps=" + FPS + ",setsar=1,setpts=PTS-STARTPTS,format=yuv420p[dv]",
    "[blk][dv]concat=n=2:v=1:a=0[base]",
    "[0:v]" + (await hdrPrefix(input.reelHdr)) + "fps=" + FPS + ",setsar=1,setpts=PTS-STARTPTS,scale=eval=frame:w='" + w + "':h='" + hh + "'[reel]",
    "[base][reel]overlay=eval=frame:x='" + x + "':y='" + y + "':eof_action=pass,format=yuv420p[v]",
    "[0:a]aresample=44100,atrim=0:" + h0 + ",asetpts=PTS-STARTPTS[a0]",
    "[1:a]aresample=44100,asetpts=PTS-STARTPTS[a1]",
    "[a0][a1]concat=n=2:v=0:a=1[a]",
  ].join(";");
  await runFfmpeg([
    "-y",
    "-i", input.reel,
    "-i", input.demo,
    "-filter_complex", filter,
    "-map", "[v]",
    "-map", "[a]",
    ...X264,
    "-crf", "23",
    ...AAC,
    "-max_muxing_queue_size", "1024",
    input.out,
  ]);
}
