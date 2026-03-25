import sys
import os
import re
import subprocess
import json
from yt_dlp import YoutubeDL

if len(sys.argv) < 2:
    print("[DOWNLOAD ERROR] Judul lagu tidak diberikan", file=sys.stderr)
    sys.exit(1)

query = " ".join(sys.argv[1:])
search_keyword = f"ytsearch5:{query}"

# ✅ Railway-friendly directory
output_dir = "/tmp/audios"
os.makedirs(output_dir, exist_ok=True)


def sanitize_filename(name):
    return re.sub(r"[^a-zA-Z0-9]", "_", name).strip("_").lower()


def convert_to_mp3(input_path):
    output_path = os.path.splitext(input_path)[0] + ".mp3"

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                input_path,
                "-vn",
                "-acodec",
                "libmp3lame",
                "-b:a",
                "128k",
                output_path,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )

        if os.path.exists(output_path):
            os.remove(input_path)
            return output_path

    except Exception as e:
        print(f"[FFMPEG ERROR] {e}", file=sys.stderr)

    return None


try:
    cookies_file = "cookiesyt.txt"

    # ================= SEARCH =================
    ydl_opts_info = {
        "quiet": True,
        "skip_download": True,
        "noplaylist": True,
        "default_search": "ytsearch",
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept-Language": "en-US,en;q=0.9",
        },
    }

    if os.path.exists(cookies_file):
        ydl_opts_info["cookiefile"] = cookies_file

    with YoutubeDL(ydl_opts_info) as ydl:
        search_result = ydl.extract_info(search_keyword, download=False)

        entries = search_result.get("entries", [])
        if not entries:
            raise Exception("Tidak ada video ditemukan")

        video_info = entries[0]
        video_url = video_info["webpage_url"]

        title = sanitize_filename(video_info.get("title", "audio"))
        output_path = os.path.join(output_dir, f"{title}.mp4")

    # ================= DOWNLOAD =================
    ydl_opts_download = {
        "format": "bestaudio/best",
        "quiet": True,
        "outtmpl": output_path,
        "noplaylist": True,
        "retries": 5,
        "fragment_retries": 5,
        "continuedl": True,
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept-Language": "en-US,en;q=0.9",
        },
    }

    if os.path.exists(cookies_file):
        ydl_opts_download["cookiefile"] = cookies_file

    with YoutubeDL(ydl_opts_download) as ydl2:
        ydl2.download([video_url])

    if not os.path.exists(output_path):
        raise Exception("File video tidak ditemukan setelah download")

    # ================= CONVERT =================
    mp3_path = convert_to_mp3(output_path)

    if not mp3_path or not os.path.exists(mp3_path):
        raise Exception("Gagal konversi ke MP3")

    # ================= OUTPUT =================
    info = {
        "title": video_info.get("title", "-"),
        "uploader": video_info.get("uploader", "-"),
        "duration": video_info.get("duration", 0),
        "thumbnail": video_info.get("thumbnail", "")
    }

    print(f"::MP3::{mp3_path}", flush=True)
    print(f"::INFO::{json.dumps(info)}", flush=True)

except Exception as e:
    print(f"[DOWNLOAD ERROR] {e}", file=sys.stderr)
    sys.exit(1)
