#!/usr/bin/env python3
"""
Pull EVERY reel from a set of Instagram accounts into the `hook_video` table,
with the MP4 + thumbnail stored in Cloudflare R2. Shown on /b/<brief>/hooks.

  python3 scripts/scrape-hooks.py --brief elevenlabs diylab2026 cairo_ia

Auth: uses your own logged-in Instagram session from a local browser
(--browser chrome|arc|brave|firefox). Nothing is posted or liked; this is the
same read traffic the web app makes when you scroll a profile.

Env (from .env.local): DATABASE_URL, R2_ENDPOINT, R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL.

Re-runnable: already-stored videos are skipped (stats refreshed), new posts
are added. Safe to Ctrl-C and resume.

Deps: pip install yt-dlp boto3 "psycopg[binary]"
"""
import argparse, json, os, random, sys, time, urllib.request, urllib.error, http.cookiejar
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
IG_APP_ID = "936619743392459"

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

# ---------------------------------------------------------------- cookies
def browser_cookies(browser: str) -> http.cookiejar.CookieJar:
    from yt_dlp.cookies import extract_cookies_from_browser
    jar = extract_cookies_from_browser(browser)
    out = http.cookiejar.CookieJar()
    for c in jar:
        if "instagram.com" in (c.domain or ""): out.set_cookie(c)
    names = {c.name for c in out}
    if "sessionid" not in names:
        sys.exit(f"no Instagram sessionid cookie in {browser}; log in to instagram.com there first")
    return out

# ---------------------------------------------------------------- instagram
class IG:
    def __init__(self, jar):
        self.jar = jar
        self.csrf = next((c.value for c in jar if c.name == "csrftoken"), "")
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def get(self, url, referer="https://www.instagram.com/", tries=4):
        h = {"User-Agent": UA, "x-ig-app-id": IG_APP_ID, "x-csrftoken": self.csrf,
             "x-requested-with": "XMLHttpRequest", "referer": referer, "accept": "*/*"}
        for i in range(tries):
            try:
                r = self.op.open(urllib.request.Request(url, headers=h), timeout=40)
                return json.loads(r.read())
            except urllib.error.HTTPError as e:
                if e.code in (429, 401, 403) or e.code >= 500:
                    wait = 30 * (i + 1)
                    print(f"    IG {e.code}; sleeping {wait}s", flush=True); time.sleep(wait); continue
                raise
            except Exception as e:
                print(f"    retry ({e})", flush=True); time.sleep(5)
        raise RuntimeError(f"gave up on {url}")

    def user_id(self, username):
        d = self.get(f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}",
                     referer=f"https://www.instagram.com/{username}/")
        u = d["data"]["user"]
        return u["id"], u["edge_owner_to_timeline_media"]["count"]

    def feed(self, uid, username):
        max_id = None
        while True:
            url = f"https://www.instagram.com/api/v1/feed/user/{uid}/?count=33"
            if max_id: url += f"&max_id={max_id}"
            d = self.get(url, referer=f"https://www.instagram.com/{username}/")
            for it in d.get("items", []): yield it
            if not d.get("more_available"): return
            max_id = d.get("next_max_id")
            time.sleep(random.uniform(2.0, 4.0))

def videos_from_item(it):
    """Yield (key_suffix, media) for every video in a post (reel or carousel)."""
    mt = it.get("media_type")
    if mt == 2: yield "", it
    elif mt == 8:
        for i, ch in enumerate(it.get("carousel_media", [])):
            if ch.get("media_type") == 2: yield f"_{i}", ch

def best_url(cands):
    cands = [c for c in (cands or []) if c.get("url")]
    if not cands: return None
    return max(cands, key=lambda c: (c.get("width") or 0) * (c.get("height") or 0))["url"]

def download(url, tries=3):
    for i in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120)
            return r.read()
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(3)

# ---------------------------------------------------------------- storage
DDL = """
CREATE TABLE IF NOT EXISTS hook_video (
  id TEXT PRIMARY KEY, brief_slug TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram', shortcode TEXT NOT NULL,
  account TEXT NOT NULL, url TEXT NOT NULL, caption TEXT,
  views BIGINT, likes BIGINT, comments BIGINT, duration REAL,
  width INTEGER, height INTEGER, posted_at TIMESTAMPTZ,
  video_key TEXT NOT NULL, video_url TEXT NOT NULL, thumb_key TEXT, thumb_url TEXT,
  bytes BIGINT, hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hook_video_brief_idx ON hook_video (brief_slug, hidden, views DESC);
"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("accounts", nargs="+", help="instagram usernames or profile urls")
    ap.add_argument("--brief", required=True, help="brief slug, e.g. elevenlabs")
    ap.add_argument("--browser", default="chrome")
    ap.add_argument("--limit", type=int, default=0, help="stop after N new videos per account (testing)")
    ap.add_argument("--dry", action="store_true", help="list only, no download/upload/db")
    a = ap.parse_args()

    load_env()
    import boto3, psycopg
    dsn = need("DATABASE_URL")
    if "sslmode" not in dsn: dsn += ("&" if "?" in dsn else "?") + "sslmode=require"
    db = psycopg.connect(dsn, autocommit=True)
    db.execute(DDL)
    s3 = boto3.client("s3", endpoint_url=need("R2_ENDPOINT"), region_name="auto",
                      aws_access_key_id=need("R2_ACCESS_KEY_ID"), aws_secret_access_key=need("R2_SECRET_ACCESS_KEY"))
    bucket, pub = need("R2_BUCKET"), need("R2_PUBLIC_URL").rstrip("/")

    ig = IG(browser_cookies(a.browser))
    existing = {r[0] for r in db.execute("SELECT id FROM hook_video WHERE brief_slug=%s", (a.brief,))}
    print(f"brief={a.brief} existing={len(existing)}")

    grand_new = 0
    for acct in a.accounts:
        username = acct.rstrip("/").split("?")[0].split("/")[-1].lstrip("@")
        uid, count = ig.user_id(username)
        print(f"\n@{username}: {count} posts", flush=True)
        seen = new = 0
        for it in ig.feed(uid, username):
            for suffix, m in videos_from_item(it):
                seen += 1
                code = it["code"]; vid = f"instagram_{code}{suffix}"
                caption = (it.get("caption") or {}).get("text")
                views = m.get("play_count") or it.get("play_count") or it.get("ig_play_count") or it.get("view_count")
                stats = dict(views=views, likes=it.get("like_count"), comments=it.get("comment_count"))
                if vid in existing:
                    db.execute("UPDATE hook_video SET views=%s, likes=%s, comments=%s, caption=COALESCE(%s,caption), updated_at=now() WHERE id=%s",
                               (stats["views"], stats["likes"], stats["comments"], caption, vid))
                    continue
                mp4 = best_url(m.get("video_versions"))
                thumb = best_url((m.get("image_versions2") or {}).get("candidates"))
                if not mp4:
                    print(f"  ! {code}: no video url, skipping"); continue
                if a.dry:
                    print(f"  {code}{suffix}  {views or '?':>10} views  {(caption or '')[:50]!r}"); new += 1
                    if a.limit and new >= a.limit: break
                    continue
                try:
                    data = download(mp4)
                    vkey = f"hooks/{username}/{code}{suffix}.mp4"
                    s3.put_object(Bucket=bucket, Key=vkey, Body=data, ContentType="video/mp4")
                    tkey = turl = None
                    if thumb:
                        tkey = f"hooks/{username}/{code}{suffix}.jpg"
                        s3.put_object(Bucket=bucket, Key=tkey, Body=download(thumb), ContentType="image/jpeg")
                        turl = f"{pub}/{tkey}"
                    posted = datetime.fromtimestamp(it["taken_at"], tz=timezone.utc) if it.get("taken_at") else None
                    db.execute("""
                        INSERT INTO hook_video (id, brief_slug, platform, shortcode, account, url, caption, views, likes, comments,
                            duration, width, height, posted_at, video_key, video_url, thumb_key, thumb_url, bytes)
                        VALUES (%s,%s,'instagram',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (id) DO UPDATE SET views=EXCLUDED.views, likes=EXCLUDED.likes, comments=EXCLUDED.comments,
                            video_url=EXCLUDED.video_url, thumb_url=EXCLUDED.thumb_url, updated_at=now()
                    """, (vid, a.brief, code, username, f"https://www.instagram.com/reel/{code}/", caption,
                          stats["views"], stats["likes"], stats["comments"], m.get("video_duration"),
                          m.get("original_width"), m.get("original_height"), posted, vkey, f"{pub}/{vkey}", tkey, turl, len(data)))
                    existing.add(vid); new += 1; grand_new += 1
                    print(f"  + {code}{suffix}  {views or '?':>10} views  {len(data)//1024:>6} KB", flush=True)
                except Exception as e:
                    print(f"  ! {code}{suffix}: {e}", flush=True)
                time.sleep(random.uniform(0.5, 1.5))
            if a.limit and new >= a.limit: break
        print(f"@{username}: scanned {seen} videos, {new} new")
    total = db.execute("SELECT count(*) FROM hook_video WHERE brief_slug=%s", (a.brief,)).fetchone()[0]
    print(f"\ndone. new={grand_new} total for {a.brief}={total}")

if __name__ == "__main__":
    main()
