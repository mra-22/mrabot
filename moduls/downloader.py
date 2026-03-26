import sys
import os
import re
import json
import subprocess
import requests
from yt_dlp import YoutubeDL
from playwright.sync_api import sync_playwright

OUTPUT_DIR = "videos"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# =============================
# LOGGER
# =============================
class QuietLogger:
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): print(msg, file=sys.stderr)

# =============================
# DEBUG (WAJIB CEK)
# =============================
print("PATH:", os.getcwd())
print("COOKIES ADA:", os.path.exists("/app/ig_cookies"))

# =============================
# EXPAND URL
# =============================
def expand_url(url):
    try:
        r = requests.get(url, allow_redirects=True, timeout=10)
        return r.url
    except:
        return url

# =============================
# CONVERT VIDEO (WA READY)
# =============================
def convert_to_whatsapp_mp4(path):
    output = os.path.splitext(path)[0] + "_wa.mp4"

    subprocess.run([
        "ffmpeg","-y","-i",path,
        "-vf","scale=480:-2",
        "-c:v","libx264",
        "-preset","fast",
        "-crf","28",
        "-c:a","aac",
        "-b:a","128k",
        "-movflags","+faststart",
        output
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if os.path.exists(path):
        os.remove(path)

    return output

# =============================
# TIKTOK SLIDESHOW
# =============================
def tiktok_slideshow(url):
    import time
    images = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled"
            ]
        )

        context = browser.new_context(
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
            viewport={"width":390,"height":844},
            is_mobile=True,
            has_touch=True
        )

        page = context.new_page()
        page.goto(url, timeout=30000)

        time.sleep(3)

        for _ in range(5):
            page.mouse.wheel(0,4000)
            time.sleep(1)

        imgs = page.query_selector_all("img")

        for img in imgs:
            src = img.get_attribute("src")
            if src and "tiktokcdn" in src:
                images.append(src)

        images = list(dict.fromkeys(images))[:10]
        browser.close()

    files = []

    for i,img in enumerate(images):
        fn = f"{OUTPUT_DIR}/tiktok_{i}.jpg"
        r = requests.get(img).content
        open(fn,"wb").write(r)
        files.append(os.path.abspath(fn))

    if not files:
        raise Exception("Slideshow gagal")

    print("::FILES::"+json.dumps(files))
    print("::INFO::"+json.dumps({
        "title":"TikTok Slideshow",
        "uploader":"TikTok"
    }))
    return True

# =============================
# INSTAGRAM FALLBACK (JSON FIX)
# =============================
def instagram_fallback(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}

        api = url.split("?")[0] + "?__a=1&__d=dis"
        r = requests.get(api, headers=headers, timeout=15)
        data = r.json()

        video_url = data["items"][0]["video_versions"][0]["url"]

        fn = os.path.join(OUTPUT_DIR, "instagram.mp4")
        vid = requests.get(video_url, timeout=20).content

        with open(fn, "wb") as f:
            f.write(vid)

        print("::FILE::" + os.path.abspath(fn))
        print("::INFO::" + json.dumps({
            "title": "Instagram Video",
            "uploader": "Instagram"
        }))
        return True

    except Exception as e:
        print("[IG FALLBACK ERROR]", e, file=sys.stderr)
        return False

# =============================
# INSTAGRAM BACKUP API
# =============================
def ig_api_backup(url):
    try:
        api = f"https://api.tiklydown.eu.org/api/download?url={url}"
        res = requests.get(api, timeout=15).json()

        if res.get("video"):
            fn = os.path.join(OUTPUT_DIR, "ig_api.mp4")
            vid = requests.get(res["video"], timeout=20).content

            with open(fn, "wb") as f:
                f.write(vid)

            print("::FILE::" + os.path.abspath(fn))
            print("::INFO::" + json.dumps({
                "title": "Instagram Video",
                "uploader": "API"
            }))
            return True
    except:
        return False

# =============================
# YTDLP DOWNLOAD (UTAMA)
# =============================
def download_video(url):
    try:
        opts = {
            "format": "best",
            "quiet": True,
            "noplaylist": True,
            "outtmpl": OUTPUT_DIR + "/%(id)s.%(ext)s",
            "logger": QuietLogger(),

            "cookiefile": "/app/ig_cookies",

            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.instagram.com/"
            },

            "extractor_args": {
                "instagram": {
                    "api_version": "v1",
                    "include_dash_manifest": False
                }
            }
        }

        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            file = ydl.prepare_filename(info)

        final = convert_to_whatsapp_mp4(file)

        print("::FILE::" + os.path.abspath(final))
        print("::INFO::" + json.dumps({
            "title": info.get("title"),
            "uploader": info.get("uploader"),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail")
        }))
        return True

    except Exception as e:
        print("[YTDLP ERROR]", e, file=sys.stderr)
        return False

# =============================
# MAIN
# =============================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)

    url = expand_url(sys.argv[1])

    # TikTok slideshow
    if "tiktok.com" in url and "/photo/" in url:
        try:
            tiktok_slideshow(url)
            sys.exit(0)
        except:
            pass

    # 1. yt-dlp utama
    if download_video(url):
        sys.exit(0)

    # 2. IG fallback JSON
    if "instagram.com" in url:
        if instagram_fallback(url):
            sys.exit(0)

    # 3. IG backup API
    if "instagram.com" in url:
        if ig_api_backup(url):
            sys.exit(0)

    print("[DOWNLOAD FAILED]", file=sys.stderr)
    sys.exit(1)
