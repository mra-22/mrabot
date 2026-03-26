import sys
import os
import re
import json
import subprocess
from yt_dlp import YoutubeDL

# ======================
# VALIDASI INPUT
# ======================
if len(sys.argv) < 2:
    print("::ERROR::Query kosong", flush=True)
    sys.exit(1)

query = " ".join(sys.argv[1:])
search = f"ytsearch1:{query}"

# ======================
# FOLDER OUTPUT (Railway aman)
# ======================
output_dir = "/tmp/audios"
os.makedirs(output_dir, exist_ok=True)

def sanitize_filename(name):
    return re.sub(r"[^a-zA-Z0-9]", "_", name).strip("_").lower()

try:
    cookies_file = os.path.join(os.path.dirname(__file__), "cookiesyt.txt")

    ydl_opts = {
        "quiet": True,
        "format": "bestaudio/best",
        "outtmpl": f"{output_dir}/%(title)s.%(ext)s",
        "noplaylist": True,

        # 🔥 ANTI BLOCK
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "web_creator"]
            }
        },

        "http_headers": {
            "User-Agent": "com.google.android.youtube/19.09.37"
        },

        "retries": 5,
        "fragment_retries": 5,
        "extractor_retries": 5,
        "force_ipv4": True,
    }

    # OPTIONAL cookies (kalau ada)
    if os.path.exists(cookies_file):
        ydl_opts["cookiefile"] = cookies_file

    # ======================
    # DOWNLOAD
    # ======================
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(search, download=True)

        if "entries" in info:
            video = info["entries"][0]
        else:
            video = info

        filepath = ydl.prepare_filename(video)

        # ======================
        # CONVERT KE MP3
        # ======================
        base, ext = os.path.splitext(filepath)
        mp3_path = base + ".mp3"

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                filepath,
                "-vn",
                "-acodec",
                "libmp3lame",
                "-b:a",
                "128k",
                mp3_path,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        if not os.path.exists(mp3_path):
            raise Exception("Gagal convert ke MP3")

        # hapus file lama
        if os.path.exists(filepath):
            os.remove(filepath)

        # ======================
        # OUTPUT KE NODE
        # ======================
        print(f"::SUCCESS::{mp3_path}", flush=True)
        print(f"::TITLE::{video.get('title','-')}", flush=True)
        print(f"::URL::{video.get('webpage_url','')}", flush=True)

except Exception as e:
    print(f"::ERROR::{str(e)}", flush=True)
    sys.exit(1)
