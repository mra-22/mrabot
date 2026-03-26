import sys
import os
import re
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
# FOLDER OUTPUT
# ======================
output_dir = "/tmp/audios"
os.makedirs(output_dir, exist_ok=True)

def sanitize_filename(name):
    return re.sub(r"[^a-zA-Z0-9]", "_", name).strip("_").lower()

video_url = None
title = query

try:
    # ======================
    # 🔥 STEP 1: SEARCH DULU (PASTI DAPAT URL)
    # ======================
    ydl_opts_search = {
        "quiet": True,
        "skip_download": True,
        "noplaylist": True,
    }

    with YoutubeDL(ydl_opts_search) as ydl:
        info = ydl.extract_info(search, download=False)

        video = info["entries"][0]
        video_url = video.get("webpage_url", "")
        title = video.get("title", query)

    # ======================
    # 🔥 STEP 2: COBA DOWNLOAD
    # ======================
    ydl_opts_download = {
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
    }

    with YoutubeDL(ydl_opts_download) as ydl:
        info = ydl.extract_info(video_url, download=True)
        filepath = ydl.prepare_filename(info)

    # ======================
    # 🔥 CONVERT KE MP3
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

    if os.path.exists(mp3_path):
        os.remove(filepath)

        print(f"::SUCCESS::{mp3_path}", flush=True)
        print(f"::TITLE::{title}", flush=True)
        print(f"::URL::{video_url}", flush=True)
    else:
        raise Exception("Convert gagal")

# ======================
# ❌ JIKA DOWNLOAD GAGAL
# ======================
except Exception as e:
    print(f"::ERROR::{str(e)}", flush=True)

    # 🔥 TAPI TETAP KIRIM URL
    if video_url:
        print(f"::TITLE::{title}", flush=True)
        print(f"::URL::{video_url}", flush=True)

    sys.exit(1)
