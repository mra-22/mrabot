import sys
import os
import re
import subprocess
from yt_dlp import YoutubeDL

# ================= CONFIG =================
OUTPUT_DIR = "/tmp/audios"
COOKIE_FILE = "cookiesyt.txt"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ================= HELPERS =================
def safe_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name)

def log(msg):
    print(msg, flush=True)

# ================= VALIDASI INPUT =================
if len(sys.argv) < 2:
    log("::ERROR::Query kosong")
    sys.exit(1)

query = " ".join(sys.argv[1:])
search = f"ytsearch1:{query}"

video_url = None
title = query
video = {}

try:
    # ================= 🔍 SEARCH =================
    with YoutubeDL({
        "quiet": True,
        "skip_download": True,
        "cookiefile": COOKIE_FILE,
        "retries": 5
    }) as ydl:

        info = ydl.extract_info(search, download=False)

        if not info or "entries" not in info or not info["entries"]:
            raise Exception("Video tidak ditemukan")

        video = info["entries"][0]

        video_url = video.get("webpage_url", "")
        title = safe_filename(video.get("title", query))

    # ================= ⬇️ DOWNLOAD =================
    ydl_opts = {
        "quiet": True,
        "format": "bestaudio/best",
        "outtmpl": f"{OUTPUT_DIR}/%(title)s.%(ext)s",
        "noplaylist": True,

        # 🔥 ANTI BOT
        "cookiefile": COOKIE_FILE,

        # 🔥 STABIL
        "retries": 10,
        "fragment_retries": 10,
        "ignoreerrors": True,

        # 🔥 BYPASS YOUTUBE
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "web", "web_creator"],
                "skip": ["hls", "dash"]
            }
        },

        # 🔥 FAKE HEADERS
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-A515F) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        },

        # 🔥 ANTI BAN
        "concurrent_fragment_downloads": 1,
        "sleep_interval": 1,
        "max_sleep_interval": 3
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=True)
        filepath = ydl.prepare_filename(info)

    # ================= 🎧 CONVERT KE MP3 =================
    base, ext = os.path.splitext(filepath)
    mp3_path = base + ".mp3"

    subprocess.run(
        ["ffmpeg", "-y", "-i", filepath, "-vn", "-acodec", "libmp3lame", "-b:a", "128k", mp3_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    if not os.path.exists(mp3_path):
        raise Exception("Convert gagal")

    # hapus file asli
    if os.path.exists(filepath):
        os.remove(filepath)

    log(f"::SUCCESS::{mp3_path}")

except Exception as e:
    log(f"::ERROR::{str(e)}")

# ================= INFO OUTPUT =================
if video_url:
    log(f"::TITLE::{title}")
    log(f"::URL::{video_url}")
    log(f"::THUMB::{video.get('thumbnail','')}")
    log(f"::UPLOADER::{video.get('uploader','-')}")
    log(f"::DURATION::{video.get('duration',0)}")
