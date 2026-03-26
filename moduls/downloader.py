import sys
import os
import json
import subprocess
import requests
from yt_dlp import YoutubeDL
from playwright.sync_api import sync_playwright
import time

OUTPUT_DIR = "videos"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# =============================
# LOGGER
# =============================
class QuietLogger:
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): sys.stderr.write(f"[YTDLP ERROR] {msg}\n")

# =============================
# DEBUG
# =============================
sys.stderr.write("DOWNLOADER START\n")
sys.stderr.write(f"PATH: {os.getcwd()}\n")
sys.stderr.write(f"COOKIES ADA: {os.path.exists('/app/ig_cookies')}\n")
sys.stderr.flush()

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
# CONVERT WA (FIX TOTAL)
# =============================
def convert_to_whatsapp_mp4(path):
    output = os.path.splitext(path)[0] + "_wa.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-i", path,
        "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0", "-pix_fmt", "yuv420p",
        "-vf", "scale=480:-2", "-r", "30",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if os.path.exists(path):
        os.remove(path)
    return output

# =============================
# TIKTOK SLIDESHOW
# =============================
def tiktok_slideshow(url):
    images = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (iPhone)",
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
        with open(fn,"wb") as f:
            f.write(r)
        files.append(os.path.abspath(fn))

    if not files:
        raise Exception("Slideshow gagal")

    sys.stderr.write("::FILES::" + json.dumps(files) + "\n")
    sys.stderr.write("::INFO::" + json.dumps({"title":"TikTok Slideshow","uploader":"TikTok"}) + "\n")
    sys.stderr.flush()
    return True

# =============================
# INSTAGRAM FALLBACK JSON
# =============================
def instagram_fallback(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        api = url.split("?")[0] + "?__a=1&__d=dis"
        r = requests.get(api, headers=headers, timeout=15)
        if not r.text.strip().startswith("{"):
            raise Exception("IG BLOCK / BUKAN JSON")
        data = r.json()
        video_url = data["items"][0]["video_versions"][0]["url"]
        fn = os.path.join(OUTPUT_DIR, "instagram.mp4")
        vid = requests.get(video_url).content
        with open(fn, "wb") as f:
            f.write(vid)
        sys.stderr.write("::FILE::" + os.path.abspath(fn) + "\n")
        sys.stderr.write("::INFO::" + json.dumps({"title": "Instagram Video","uploader":"Instagram"}) + "\n")
        sys.stderr.flush()
        return True
    except Exception as e:
        sys.stderr.write(f"[IG FALLBACK ERROR] {e}\n")
        sys.stderr.flush()
        return False

# =============================
# INSTAGRAM API BACKUP
# =============================
def ig_api_backup(url):
    try:
        api = f"https://api.tiklydown.eu.org/api/download?url={url}"
        res = requests.get(api, timeout=15).json()
        if res.get("video"):
            fn = os.path.join(OUTPUT_DIR, "ig_api.mp4")
            vid = requests.get(res["video"]).content
            with open(fn, "wb") as f:
                f.write(vid)
            sys.stderr.write("::FILE::" + os.path.abspath(fn) + "\n")
            sys.stderr.write("::INFO::" + json.dumps({"title":"Instagram Video","uploader":"API"}) + "\n")
            sys.stderr.flush()
            return True
    except:
        return False

# =============================
# YTDLP DOWNLOAD
# =============================
def download_video(url):
    try:
        sys.stderr.write(f"PATH: {os.getcwd()}\n")
        sys.stderr.write(f"COOKIES ADA: {os.path.exists('/app/ig_cookies')}\n")
        sys.stderr.flush()

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
            "extractor_args": {"instagram":{"api_version":"v1","include_dash_manifest":False}},
            "postprocessors": [{"key":"FFmpegVideoConvertor","preferedformat":"mp4"}],
            "sleep_interval": 2,
            "max_sleep_interval": 5
        }

        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            file = ydl.prepare_filename(info)

        final = convert_to_whatsapp_mp4(file)

        sys.stderr.write("::FILE::" + os.path.abspath(final) + "\n")
        sys.stderr.write("::INFO::" + json.dumps({
            "title": info.get("title"),
            "uploader": info.get("uploader"),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail")
        }) + "\n")
        sys.stderr.flush()
        return True

    except Exception as e:
        sys.stderr.write(f"[YTDLP ERROR] {e}\n")
        sys.stderr.flush()
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

    # 3. IG API backup
    if "instagram.com" in url:
        if ig_api_backup(url):
            sys.exit(0)

    sys.stderr.write("[DOWNLOAD FAILED]\n")
    sys.stderr.flush()
    sys.exit(1)
