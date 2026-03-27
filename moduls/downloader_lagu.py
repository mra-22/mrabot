import sys
import os
import re
import subprocess
from yt_dlp import YoutubeDL

# ===================== VALIDASI =====================
if len(sys.argv) < 2:
    print("::ERROR::Query kosong", flush=True)
    sys.exit(1)

query = " ".join(sys.argv[1:])
search = f"ytsearch1:{query}"

output_dir = "./audios"  # 🔥 ganti dari /tmp biar aman di Windows/Linux
os.makedirs(output_dir, exist_ok=True)

video_url = None
title = query
video = {}

# ===================== HELPER =====================
def safe_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name)


try:
    # ===================== SEARCH =====================
    with YoutubeDL({
        "quiet": True,
        "skip_download": True,
        "noplaylist": True,
        "nocheckcertificate": True,
        "geo_bypass": True,
        "cookiefile": "cookiesyt.txt",
        "extractor_args": {"youtube": {"player_client": ["android"]}},
    }) as ydl:

        info = ydl.extract_info(search, download=False)

        if not info or "entries" not in info or not info["entries"]:
            raise Exception("Video tidak ditemukan")

        video = info["entries"][0]

        video_url = video.get("webpage_url", "")
        title = video.get("title", query)

    # ===================== DOWNLOAD =====================
    safe_title = safe_filename(title)
    output_template = f"{output_dir}/{safe_title}.%(ext)s"

    ydl_opts = {
        "quiet": True,
        "format": "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
        "outtmpl": output_template,
        "noplaylist": True,
        "nocheckcertificate": True,
        "geo_bypass": True,
        "cookiefile": "cookiesyt.txt",
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "web_creator"]
            }
        },
        "http_headers": {
            "User-Agent": "com.google.android.youtube/19.09.37"
        }
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=True)
        filepath = ydl.prepare_filename(info)

    if not os.path.exists(filepath):
        raise Exception("File tidak ditemukan setelah download")

    # ===================== CONVERT =====================
    base, _ = os.path.splitext(filepath)
    mp3_path = base + ".mp3"

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i", filepath,
            "-vn",
            "-acodec", "libmp3lame",
            "-b:a", "128k",
            mp3_path
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    # ===================== VALIDASI HASIL =====================
    if not os.path.exists(mp3_path):
        raise Exception("Convert gagal (ffmpeg error)")

    # hapus file video
    try:
        os.remove(filepath)
    except:
        pass

    # ===================== OUTPUT KE NODE =====================
    print(f"::SUCCESS::{mp3_path}", flush=True)

except Exception as e:
    print(f"::ERROR::{str(e)}", flush=True)

# ===================== INFO (WAJIB KIRIM) =====================
if video_url:
    print(f"::TITLE::{title}", flush=True)
    print(f"::URL::{video_url}", flush=True)
    print(f"::THUMB::{video.get('thumbnail','')}", flush=True)
    print(f"::UPLOADER::{video.get('uploader','-')}", flush=True)
    print(f"::DURATION::{video.get('duration',0)}", flush=True)
