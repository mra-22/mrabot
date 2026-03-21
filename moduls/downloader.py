import sys
import os
import re
import json
import subprocess
import requests
from yt_dlp import YoutubeDL
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

# =============================
# CONFIG / PREPARE
# =============================

OUTPUT_DIR = "videos"
os.makedirs(OUTPUT_DIR, exist_ok=True)

MAX_TITLE_LEN = 60  # Batasi nama file aman Windows

class QuietLogger:
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): print(msg, file=sys.stderr)
def expand_url(url):
    try:
        r = requests.get(url, allow_redirects=True, timeout=10)
        return r.url
    except Exception as e:
        print(f"[EXPAND ERROR] {e}", file=sys.stderr)
        return url

def download_images(urls):
    output_files = []

    for i, url in enumerate(urls):
        fn = os.path.join(OUTPUT_DIR, f"tiktok_{i+1}.jpg")

        img = requests.get(url, timeout=15).content

        with open(fn, "wb") as f:
            f.write(img)

        output_files.append(os.path.abspath(fn))

    return output_files

def safe_filename(name: str):
    if not name:
        name = "video"
    # Hilangkan karakter berbahaya Windows
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = name.strip()
    # batasi panjang
    return name[:MAX_TITLE_LEN]

# =============================
# FFMPEG convert to WhatsApp MP4
# =============================

def convert_to_whatsapp_mp4(path):
    """
    Konversi SEMUA file video (webm/mkv/mp4/etc) menjadi MP4 kompatibel WhatsApp.
    """
    output_path = os.path.splitext(path)[0] + "_wa.mp4"

    try:
        subprocess.run([
            "ffmpeg",
            "-y",
            "-i", path,
            "-vf", "scale=480:-2",
            "-c:v", "libx264",
            "-profile:v", "main",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-crf", "28",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            output_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        # Hapus file original
        if os.path.exists(path):
            os.remove(path)

        return output_path

    except Exception as e:
        print(f"[FFMPEG ERROR] {e}", file=sys.stderr)
        return path

# =============================
# TikTok Slideshow Extractor
# =============================

def extract_tiktok_slideshow_photos(url):
    from playwright.sync_api import sync_playwright
    import time, os, requests, re

    images = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox"
            ]
        )

        context = browser.new_context(
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
            viewport={"width": 390, "height": 844}
        )

        page = context.new_page()

        # retry
        for attempt in range(3):
            try:
                page.goto(url, timeout=30000, wait_until="networkidle")
                break
            except:
                if attempt == 2:
                    browser.close()
                    raise Exception("Gagal load TikTok (timeout 3x)")
                time.sleep(2)

        time.sleep(5)

        # scroll biar semua ke-load
        for _ in range(8):
            page.mouse.wheel(0, 4000)
            time.sleep(1)

        imgs = page.query_selector_all("img")

        for img in imgs:
            src = img.get_attribute("src")
            if not src:
                continue

            # hanya ambil gambar slideshow
            if not any(x in src for x in ["tiktokcdn.com", "muscdn.com"]):
                continue

            if any(x in src for x in ["avatar", "icon", "emoji", "logo"]):
                continue

            if not re.search(r'/\d{3,}x\d{3,}/|tplv', src):
                continue

            # ambil index dari URL
            order = 9999
            match = re.search(r'/(\d+)~', src)
            if match:
                order = int(match.group(1))

            images.append((order, src))

        # urutkan
        images.sort(key=lambda x: x[0])

        # ambil URL
        images = [x[1] for x in images]

        # dedup
        images = list(dict.fromkeys(images))

        # limit
        images = images[:20]

        browser.close()

    if not images:
        raise Exception("Gagal ambil gambar (TikTok proteksi tinggi / struktur berubah)")

    # download
    output_files = []
    for i, img_url in enumerate(images):
        fn = os.path.join(OUTPUT_DIR, f"tiktok_{i+1}.jpg")

        img = requests.get(img_url, timeout=15).content
        with open(fn, "wb") as f:
            f.write(img)

        output_files.append(os.path.abspath(fn))

    return output_files
# =============================
# Pinterest fallback simple
# =============================

def pinterest_fallback(url):
    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")
        og = soup.find("meta", property="og:image")

        if not og:
            raise Exception("Tidak menemukan og:image")

        img_url = og.get("content")
        ext = os.path.splitext(img_url.split("?")[0])[1] or ".jpg"
        fn = os.path.join(OUTPUT_DIR, "pinterest" + ext)

        img = requests.get(img_url, timeout=10).content
        with open(fn, "wb") as f:
            f.write(img)

        print(os.path.abspath(fn))
        print("::INFO::" + json.dumps({
            "title": "Pinterest Image",
            "uploader": "-",
            "view_count": 0,
            "duration": 0
        }))
        return True

    except Exception as e:
        print(f"[PINTEREST ERROR] {e}", file=sys.stderr)
        return False

# =============================
# MAIN YT-DLP DOWNLOAD
# =============================

def download_video(url):
    try:
        opts = {
            "format": "bv*+ba/best",
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,

            # 🔥 FIX UTAMA (ANTI EMOJI)
            "outtmpl": OUTPUT_DIR + "/%(id)s.%(ext)s",

            "logger": QuietLogger(),
        }

        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

        # tunggu file siap
        import time
        for _ in range(15):
            if os.path.exists(filename):
                break
            time.sleep(0.5)

        if not os.path.exists(filename):
            raise Exception("File tidak ditemukan setelah download")

        # 🔥 konversi WA
        final_path = convert_to_whatsapp_mp4(filename)

        # 🔥 OUTPUT WAJIB (FIX NODE)
        print(f"::FILE::{os.path.abspath(final_path)}")

        print("::INFO::" + json.dumps({
            "title": info.get("title"),
            "uploader": info.get("uploader"),
            "view_count": info.get("view_count"),
            "duration": info.get("duration"),
        }))

        return True

    except Exception as e:
        print(f"[YTDLP ERROR] {e}", file=sys.stderr)
        return False
# =============================
# ENTRY POINT
# =============================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python downloader.py <url>")
        sys.exit(1)

    # 🔥 EXPAND SHORT LINK
    url = expand_url(sys.argv[1])
    print(f"[EXPANDED URL] {url}", file=sys.stderr)

    # =============================
    # TikTok slideshow
    # =============================
    if "tiktok.com" in url and "/photo/" in url:
        try:
            photos = extract_tiktok_slideshow_photos(url)

            # kirim 1 foto (atau nanti bisa upgrade kirim semua)
            print("::FILES::" + json.dumps(photos))

            print("::INFO::" + json.dumps({
                "title": "TikTok Slideshow",
                "uploader": "-",
                "view_count": 0
            }))

            sys.exit(0)

        except Exception as e:
            print(f"[TIKTOK ERROR] {e}", file=sys.stderr)
            sys.exit(1)

    # =============================
    # Normal video
    # =============================
    if download_video(url):
        sys.exit(0)

    # =============================
    # Pinterest fallback
    # =============================
    if "pinterest" in url:
        if pinterest_fallback(url):
            sys.exit(0)

    print("[DOWNLOAD FAILED]", file=sys.stderr)
    sys.exit(1)