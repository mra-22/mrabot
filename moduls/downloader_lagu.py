import sys
import os
import re
import subprocess
import hashlib
from yt_dlp import YoutubeDL

# ===================== VALIDASI =====================
if len(sys.argv) < 2:
    print("::ERROR::URL kosong", flush=True)
    sys.exit(0)

video_url = sys.argv[1]

output_dir = "./audios"
os.makedirs(output_dir, exist_ok=True)

# ===================== HELPER =====================
def safe_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name)

def get_cache_name(text):
    return hashlib.md5(text.encode()).hexdigest()

# ===================== CACHE =====================
cache_name = get_cache_name(video_url)
mp3_path = f"{output_dir}/{cache_name}.mp3"

if os.path.exists(mp3_path):
    print(f"::SUCCESS::{mp3_path}", flush=True)
    sys.exit(0)

# ===================== DOWNLOAD =====================
filepath = None

try:
    ydl_opts = {
        "quiet": True,
        "format": "best",  # 🔥 paling stabil
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

# ===================== VALIDASI DOWNLOAD =====================
if not filepath or not os.path.exists(filepath):
    print("::ERROR::DOWNLOAD_FAIL", flush=True)
    sys.exit(0)

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
