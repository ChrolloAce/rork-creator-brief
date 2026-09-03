#!/usr/bin/env python3
"""
Pull a YouTube channel's Shorts into `hook_video` (same table the Instagram
scraper fills), MP4s in Cloudflare R2. Free: yt-dlp only, no API keys.

  python3 scripts/scrape-youtube-shorts.py --brief elevenlabs @zackdfilms

Quality/storage: YouTube's own H.264 + AAC stream at --res (default 720,
~3 MB per short; 1080 is ~7-8 MB), remuxed with no re-encode. Plays
everywhere (iOS included). Thumbnails are YouTube's stable i.ytimg.com URLs.

YouTube now forces SABR streaming on the web client, which hides 720p+ URLs
unless a PO token is supplied. Free fix, one-time setup:
  pip install yt-dlp bgutil-ytdlp-pot-provider
  git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider && cd bgutil-ytdlp-pot-provider/server && npm i && npx tsc
Then set POT_SERVER_DIR=/path/to/bgutil-ytdlp-pot-provider/server in .env.local;
this script starts the token server itself if nothing is listening on :4416.
Node must be on PATH (yt-dlp uses it as its JS runtime).

--cap-gb: hard stop when the R2 bucket would exceed this many GB in total
(default 9.85, just under the 10 GB free tier). Re-runnable: existing videos
are skipped and their stats refreshed.
"""
import argparse, json, os, random, subprocess, sys, tempfile, time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Sort-based selection (the [vcodec^=avc1] filter form silently skips the
# PO-token formats; -S does not). Highest H.264 at or under --res, direct https.
def sort_spec(res): return f"res:{res},vcodec:h264,acodec:aac,proto:https"
YTDLP_BASE = ["yt-dlp", "--js-runtimes", "node"]

def ensure_pot_server():
    import socket, subprocess as sp
    with socket.socket() as sk:
        sk.settimeout(0.5)
        if sk.connect_ex(("127.0.0.1", 4416)) == 0: return
    d = os.environ.get("POT_SERVER_DIR")
    if not d or not os.path.exists(os.path.join(d, "build", "main.js")):
        print("WARNING: no PO token server on :4416 and POT_SERVER_DIR unset; YouTube may cap at 480p", flush=True); return
    sp.Popen(["node", os.path.join(d, "build", "main.js")], stdout=sp.DEVNULL, stderr=sp.DEVNULL, start_new_session=True)
    time.sleep(3); print("started PO token server", flush=True)

def load_env():
    for name in (".env.local", ".env"):
        p = ROOT / name
        if not p.exists(): continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def need(k):
    v = os.environ.get(k)
    if not v: sys.exit(f"missing env {k}")
    return v

def bucket_bytes(s3, bucket):
    t = 0
    for p in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket):
        for o in p.get("Contents", []): t += o["Size"]
    return t

def list_shorts(channel):
    url = f"https://www.youtube.com/{channel}/shorts"
    out = subprocess.run(YTDLP_BASE + ["--flat-playlist", "-j", url], capture_output=True, text=True, timeout=900)
    items = []
    for line in out.stdout.splitlines():
        try: d = json.loads(line)
        except Exception: continue
        if d.get("id"): items.append(d)
    return items

def download(vid, dir, res):
    out = os.path.join(dir, f"{vid}.%(ext)s")
    cmd = YTDLP_BASE + ["-f", "bv*+ba/b", "-S", sort_spec(res), "--merge-output-format", "mp4", "--no-playlist", "--no-progress", "-q",
           "--print-json", "-o", out, f"https://www.youtube.com/shorts/{vid}"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if r.returncode != 0: raise RuntimeError(r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "yt-dlp failed")
    meta = json.loads(r.stdout.strip().splitlines()[-1])
    path = os.path.join(dir, f"{vid}.mp4")
    if not os.path.exists(path):
        cands = [f for f in os.listdir(dir) if f.startswith(vid + ".")]
        if not cands: raise RuntimeError("no output file")
        path = os.path.join(dir, cands[0])
    return meta, path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("channel", help="@handle")
    ap.add_argument("--brief", required=True)
    ap.add_argument("--cap-gb", type=float, default=9.85)
    ap.add_argument("--limit", type=int, default=0, help="stop after N new videos (testing)")
    ap.add_argument("--order", choices=["views", "newest"], default="views")
    ap.add_argument("--res", type=int, default=720, help="max height: 720 (~3 MB/short) or 1080 (~7 MB/short)")
    a = ap.parse_args()
    load_env()
    ensure_pot_server()
    import boto3, psycopg
    dsn = need("DATABASE_URL")
    if "sslmode" not in dsn: dsn += ("&" if "?" in dsn else "?") + "sslmode=require"
    db = psycopg.connect(dsn, autocommit=True)
    s3 = boto3.client("s3", endpoint_url=need("R2_ENDPOINT"), region_name="auto",
                      aws_access_key_id=need("R2_ACCESS_KEY_ID"), aws_secret_access_key=need("R2_SECRET_ACCESS_KEY"))
    bucket, pub = need("R2_BUCKET"), need("R2_PUBLIC_URL").rstrip("/")
    cap = int(a.cap_gb * 1e9)
    handle = a.channel.strip().lstrip("@").rstrip("/").split("/")[-1]
    account = handle

    used = bucket_bytes(s3, bucket)
    print(f"R2 now {used/1e9:.2f} GB | cap {a.cap_gb} GB | headroom {(cap-used)/1e9:.2f} GB", flush=True)
    items = list_shorts("@" + handle)
    print(f"@{handle}: {len(items)} shorts listed", flush=True)
    if a.order == "views":
        items.sort(key=lambda d: d.get("view_count") or 0, reverse=True)
    existing = {r[0] for r in db.execute("SELECT id FROM hook_video WHERE brief_slug=%s", (a.brief,))}

    new = skipped = failed = 0
    with tempfile.TemporaryDirectory() as tmp:
        for it in items:
            vid = it["id"]; hid = f"youtube_{vid}"
            if hid in existing:
                if it.get("view_count") is not None:
                    db.execute("UPDATE hook_video SET views=%s, updated_at=now() WHERE id=%s", (it["view_count"], hid))
                skipped += 1; continue
            if a.limit and new >= a.limit: break
            try:
                meta, path = download(vid, tmp, a.res)
                size = os.path.getsize(path)
                if used + size > cap:
                    print(f"\nSTOP: next file ({size/1e6:.1f} MB) would pass the cap. R2 at {used/1e9:.2f} GB.", flush=True)
                    os.remove(path); break
                key = f"hooks/yt_{handle}/{vid}.mp4"
                s3.upload_file(path, bucket, key, ExtraArgs={"ContentType": "video/mp4"})
                os.remove(path); used += size
                posted = datetime.fromtimestamp(meta["timestamp"], tz=timezone.utc) if meta.get("timestamp") else (
                    datetime.strptime(meta["upload_date"], "%Y%m%d").replace(tzinfo=timezone.utc) if meta.get("upload_date") else None)
                caption = (meta.get("title") or "").strip()
                desc = (meta.get("description") or "").strip()
                if desc and desc != caption: caption = f"{caption}\n{desc}" if caption else desc
                db.execute("""
                    INSERT INTO hook_video (id, brief_slug, platform, shortcode, account, url, caption, views, likes, comments,
                        duration, width, height, posted_at, video_key, video_url, thumb_key, thumb_url, bytes)
                    VALUES (%s,%s,'youtube',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NULL,%s,%s)
                    ON CONFLICT (id) DO UPDATE SET views=EXCLUDED.views, likes=EXCLUDED.likes, comments=EXCLUDED.comments, updated_at=now()
                """, (hid, a.brief, vid, account, f"https://www.youtube.com/shorts/{vid}", caption[:2000] or None,
                      meta.get("view_count"), meta.get("like_count"), meta.get("comment_count"),
                      meta.get("duration"), meta.get("width"), meta.get("height"), posted,
                      key, f"{pub}/{key}", meta.get("thumbnail"), size))
                existing.add(hid); new += 1
                print(f"  + {vid}  {meta.get('view_count') or '?':>10} views  {size/1e6:5.1f} MB  R2 {used/1e9:.2f} GB", flush=True)
                time.sleep(random.uniform(0.5, 1.5))
            except Exception as e:
                failed += 1; print(f"  ! {vid}: {str(e)[:120]}", flush=True)
                if failed > 25 and new == 0: sys.exit("too many failures, aborting")
    total = db.execute("SELECT count(*) FROM hook_video WHERE brief_slug=%s AND account=%s", (a.brief, account)).fetchone()[0]
    print(f"\ndone. new={new} skipped={skipped} failed={failed} | @{handle} total in db={total} | R2 {used/1e9:.2f} GB", flush=True)

if __name__ == "__main__":
    main()
