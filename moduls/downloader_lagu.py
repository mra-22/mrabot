import sys
import os
import re
import subprocess
import hashlib
from yt_dlp import YoutubeDL

# ===================== VALIDASI =====================
if len(sys.argv) < 2:
    print("::ERROR::Query kosong", flush=True)

query = " ".join(sys.argv[1:])
search = f"ytsearch1:{query}"

output_dir = "./audios"
os.makedirs(output_dir, exist_ok=True)

video_url = None
title = query
video = {}

# ===================== HELPER =====================
def safe_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name)

def get_cache_name(text):
    return hashlib.md5(text.encode()).hexdigest()

# ===================== SEARCH =====================
try:
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

except Exception as e:
    print(f"::ERROR::{str(e)}", flush=True)

# ===================== CACHE =====================
cache_key = video_url if video_url else query
cache_name = get_cache_name(cache_key)
mp3_path = f"{output_dir}/{cache_name}.mp3"

if os.path.exists(mp3_path):
    print(f"::SUCCESS::{mp3_path}", flush=True)

else:
    # ===================== DOWNLOAD =====================
    filepath = None

    try:
        ydl_opts = {
            "quiet": True,
            "format": "best",  # 🔥 paling aman
            "outtmpl": f"{output_dir}/{cache_name}.%(ext)s",
            "noplaylist": True,

            "nocheckcertificate": True,
            "geo_bypass": True,
            "cookiefile": "cookiesyt.txt",

            "ignoreerrors": True,
            "no_warnings": True,
            "skip_unavailable_fragments": True,

            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web_creator", "ios"]
                }
            },

            "http_headers": {
                "User-Agent": "com.google.android.youtube/19.09.37"
            }
        }

        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)

            if info:
                try:
                    filepath = ydl.prepare_filename(info)
                except:
                    filepath = None

    except Exception as e:
        print(f"::ERROR::{str(e)}", flush=True)

    # ===================== VALIDASI FILE =====================
    if not filepath or not os.path.exists(filepath):
        print("::ERROR::DOWNLOAD_FAIL", flush=True)

    else:
        # ===================== CONVERT =====================
        try:
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

            if os.path.exists(mp3_path):
                try:
                    os.remove(filepath)
                except:
                    pass

                print(f"::SUCCESS::{mp3_path}", flush=True)

            else:
                print("::ERROR::CONVERT_FAIL", flush=True)

        except Exception as e:
            print(f"::ERROR::{str(e)}", flush=True)

# ===================== INFO (WAJIB) =====================
if video_url:
    print(f"::TITLE::{title}", flush=True)
    print(f"::URL::{video_url}", flush=True)
    print(f"::THUMB::{video.get('thumbnail','')}", flush=True)
    print(f"::UPLOADER::{video.get('uploader','-')}", flush=True)
    print(f"::DURATION::{video.get('duration',0)}", flush=True)
