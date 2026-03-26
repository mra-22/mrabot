import sys
import os
import re
import json
from yt_dlp import YoutubeDL

# ======================
# Ambil query
# ======================
if len(sys.argv) < 2:
    print("::ERROR::Query kosong")
    sys.exit(1)

query = " ".join(sys.argv[1:])
search = f"ytsearch1:{query}"

# ======================
# Folder output (Railway aman)
# ======================
output_dir = "/tmp/audios"
os.makedirs(output_dir, exist_ok=True)

def sanitize_filename(name):
    return re.sub(r"[^a-zA-Z0-9]", "_", name).strip("_").lower()

try:
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
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(search, download=True)

        if "entries" in info:
            video = info["entries"][0]
        else:
            video = info

        filepath = ydl.prepare_filename(video)

        # Rename biar pasti mp3
        base, ext = os.path.splitext(filepath)
        mp3_path = base + ".mp3"

        # Convert pakai ffmpeg
        os.system(f'ffmpeg -y -i "{filepath}" -vn -acodec libmp3lame -b:a 128k "{mp3_path}" > /dev/null 2>&1')

        if os.path.exists(mp3_path):
            os.remove(filepath)

            print(f"::SUCCESS::{mp3_path}", flush=True)
            print(f"::TITLE::{video.get('title','-')}", flush=True)
        else:
            raise Exception("Convert gagal")

except Exception as e:
    print(f"::ERROR::{str(e)}", flush=True)
    sys.exit(1)
