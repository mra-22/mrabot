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
    def debug(self, msg): 
        pass

    def warning(self, msg): 
        pass

    def error(self, msg): 
        sys.stderr.write(f"[YTDLP ERROR] {msg}\n")

# =============================
# DEBUG
# =============================
sys.stderr.write("DOWNLOADER START\n")
sys.stderr.write(f"PATH: {os.getcwd()}\n")
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
# CONVERT WA MP4
# =============================
def convert_to_whatsapp_mp4(path):
    output = os.path.splitext(path)[0] + "_wa.mp4"

    cmd = [
        "ffmpeg", "-y", "-i", path,
        "-c:v", "libx264",
        "-profile:v", "baseline",
        "-level", "3.0",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=480:-2",
        "-r", "30",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        output
    ]

    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if not os.path.exists(output):
        raise Exception("FFMPEG gagal convert")

    if os.path.exists(path):
        os.remove(path)

    return output

# =============================
# TIKTOK SLIDESHOW
# =============================
def tiktok_slideshow(url):
    images = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (iPhone)",
            viewport={"width": 390, "height": 844},
            is_mobile=True
        )

        page = context.new_page()
        page.goto(url, timeout=30000)
        time.sleep(3)

        imgs = page.query_selector_all("img")
        for img in imgs:
            src = img.get_attribute("src")
            if src and "tiktokcdn" in src:
                images.append(src)

        browser.close()

    images = list(dict.fromkeys(images))[:10]

    files = []
    for i, img in enumerate(images):
        fn = f"{OUTPUT_DIR}/tiktok_{i}.jpg"
        r = requests.get(img).content

        with open(fn, "wb") as f:
            f.write(r)

        files.append(os.path.abspath(fn))

    if not files:
        raise Exception("Slideshow gagal")

    sys.stderr.write("::FILES::" + json.dumps(files) + "\n")
    sys.stderr.write("::INFO::" + json.dumps({
        "title": "TikTok Slideshow",
        "uploader": "TikTok"
    }) + "\n")
    sys.stderr.flush()

    return True

# =============================
# INSTAGRAM FALLBACK
# =============================
def instagram_fallback(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        api = url.split("?")[0] + "?__a=1&__d=dis"

        r = requests.get(api, headers=headers, timeout=15)
        data = r.json()

        video_url = data["items"][0]["video_versions"][0]["url"]

        fn = os.path.join(OUTPUT_DIR, "instagram.mp4")
        vid = requests.get(video_url).content

        with open(fn, "wb") as f:
            f.write(vid)

        sys.stderr.write("::FILE::" + os.path.abspath(fn) + "\n")
        sys.stderr.write("::INFO::" + json.dumps({
            "title": "Instagram Video",
            "uploader": "Instagram"
        }) + "\n")
        sys.stderr.flush()

        return True

    except Exception as e:
        sys.stderr.write(f"[IG FALLBACK ERROR] {e}\n")
        return False

# =============================
# YTDLP DOWNLOAD (FIX)
# =============================
def download_video(url):
    try:
        opts = {
            "format": "mp4/bestvideo+bestaudio",
            "merge_output_format": "mp4",
            "outtmpl": OUTPUT_DIR + "/%(id)s.%(ext)s",
            "quiet": True,
            "noplaylist": True,
            "logger": QuietLogger(),
            "cookiefile": "/app/tiktok_cookies.txt",
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
                "Referer": "https://www.tiktok.com/"
            },
            "extractor_args": {
                "tiktok": {
                    "api_hostname": "api16-normal-c-useast1a.tiktokv.com"
                }
            }
        }

        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)

            if "requested_downloads" in info:
                file = info["requested_downloads"][0]["filepath"]
            elif "_filename" in info:
                file = info["_filename"]
            else:
                raise Exception("File tidak ditemukan dari yt-dlp")

        if not os.path.exists(file):
            raise Exception(f"File tidak ada: {file}")

        final = convert_to_whatsapp_mp4(file)

        if not os.path.exists(final):
            raise Exception("Convert gagal")

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
# TIKTOK API FALLBACK
# =============================
def tiktok_api_fallback(url):
    try:
        api = f"https://api.tiklydown.eu.org/api/download?url={url}"
        res = requests.get(api, timeout=15).json()

        if res.get("video"):
            fn = os.path.join(OUTPUT_DIR, "tiktok_api.mp4")
            vid = requests.get(res["video"]).content

            with open(fn, "wb") as f:
                f.write(vid)

            sys.stderr.write("::FILE::" + os.path.abspath(fn) + "\n")
            sys.stderr.write("::INFO::" + json.dumps({
                "title": "TikTok Video",
                "uploader": "API"
            }) + "\n")
            sys.stderr.flush()

            return True

    except:
        pass

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

    # utama
    if download_video(url):
        sys.exit(0)

    # fallback TikTok
    if "tiktok.com" in url:
        if tiktok_api_fallback(url):
            sys.exit(0)

    # fallback IG
    if "instagram.com" in url:
        if instagram_fallback(url):
            sys.exit(0)

    sys.stderr.write("[DOWNLOAD FAILED]\n")
    sys.stderr.flush()
    sys.exit(1)
