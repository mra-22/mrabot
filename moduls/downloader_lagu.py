import sys
import os
import re
from yt_dlp import YoutubeDL

OUTPUT_DIR = "/tmp/audios"
COOKIE_FILE = "cookiesyt.txt"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def safe_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name)

def log(msg):
    print(msg, flush=True)

if len(sys.argv) < 2:
    log("::ERROR::Query kosong")
    sys.exit(1)

query = " ".join(sys.argv[1:])
quality = "128"

# 🔥 ambil kualitas dari argumen
if "--320" in query:
    quality = "320"
    query = query.replace("--320", "").strip()

search = f"ytsearch1:{query}"

video_url = None
title = query
video = {}

try:
    # 🔍 SEARCH
    with YoutubeDL({
        "quiet": True,
        "skip_download": True,
        "cookiefile": COOKIE_FILE
    }) as ydl:

        info = ydl.extract_info(search, download=False)
        video = info["entries"][0]

        video_url = video.get("webpage_url", "")
        title = safe_filename(video.get("title", query))

    # ⬇️ DOWNLOAD + AUTO CONVERT
    ydl_opts = {
        "quiet": True,
        "format": "bestaudio/best",
        "outtmpl": f"{OUTPUT_DIR}/%(title)s.%(ext)s",
        "noplaylist": True,
        "cookiefile": COOKIE_FILE,

        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": quality,
        }],

        "http_headers": {
            "User-Agent": "Mozilla/5.0"
        },

        "retries": 10,
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=True)
        filepath = os.path.splitext(ydl.prepare_filename(info))[0] + ".mp3"

    if not os.path.exists(filepath):
        raise Exception("Download gagal")

    log(f"::SUCCESS::{filepath}")

except Exception as e:
    log(f"::ERROR::{str(e)}")

# 🔥 INFO
if video_url:
    log(f"::TITLE::{title}")
    log(f"::URL::{video_url}")
    log(f"::THUMB::{video.get('thumbnail','')}")
    log(f"::UPLOADER::{video.get('uploader','-')}")
    log(f"::DURATION::{video.get('duration',0)}")
