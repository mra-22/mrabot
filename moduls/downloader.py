import sys
import os
import re
import json
import subprocess
import requests
from yt_dlp import YoutubeDL
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

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
# EXPAND URL
# =============================
def expand_url(url):
    try:
        r = requests.get(url, allow_redirects=True, timeout=10)
        return r.url
    except:
        return url

# =============================
# CONVERT VIDEO
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
                "--disable-setuid-sandbox",
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
            if not src: continue

            if "tiktokcdn" in src:
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
# INSTAGRAM FALLBACK
# =============================
def instagram_fallback(url):
    try:
        headers = {"User-Agent":"Mozilla/5.0"}
        html = requests.get(url,headers=headers).text

        video = re.search(r'"video_url":"([^"]+)"', html)
        if not video:
            raise Exception("Video tidak ditemukan")

        video_url = video.group(1).replace("\\u0026","&")

        fn = f"{OUTPUT_DIR}/instagram.mp4"
        open(fn,"wb").write(requests.get(video_url).content)

        print("::FILE::"+os.path.abspath(fn))
        print("::INFO::"+json.dumps({
            "title":"Instagram Video",
            "uploader":"Instagram"
        }))
        return True

    except Exception as e:
        print("[IG ERROR]",e,file=sys.stderr)
        return False

# =============================
# YTDLP DOWNLOAD (UTAMA)
# =============================
def download_video(url):
    try:
        opts = {
            "format":"bv*+ba/best",
            "quiet":True,
            "noplaylist":True,
            "outtmpl":OUTPUT_DIR+"/%(id)s.%(ext)s",
            "logger":QuietLogger(),

            # 🔥 COOKIES IG
            "cookiefile":"ig_cookies.txt",

            "http_headers":{
                "User-Agent":"Mozilla/5.0"
            }
        }

        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url,download=True)
            file = ydl.prepare_filename(info)

        final = convert_to_whatsapp_mp4(file)

        print("::FILE::"+os.path.abspath(final))
        print("::INFO::"+json.dumps({
            "title":info.get("title"),
            "uploader":info.get("uploader"),
            "duration":info.get("duration"),
            "thumbnail":info.get("thumbnail")
        }))
        return True

    except Exception as e:
        print("[YTDLP ERROR]",e,file=sys.stderr)
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

    # yt-dlp utama
    if download_video(url):
        sys.exit(0)

    # IG fallback
    if "instagram.com" in url:
        if instagram_fallback(url):
            sys.exit(0)

    print("[DOWNLOAD FAILED]",file=sys.stderr)
    sys.exit(1)
