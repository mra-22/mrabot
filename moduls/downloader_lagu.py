import sys
import os
import re
import subprocess
import json

if len(sys.argv) < 2:
    print("[DOWNLOAD ERROR] Judul lagu tidak diberikan", file=sys.stderr)
    sys.exit(1)

query = " ".join(sys.argv[1:])
output_dir = "audios"
os.makedirs(output_dir, exist_ok=True)


def sanitize_filename(name):
    return re.sub(r"[^a-zA-Z0-9]", "_", name).strip("_").lower()


try:
    # ================= SEARCH + DOWNLOAD =================
    cmd = [
        "yt-dlp",
        f"ytsearch1:{query}",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "128K",
        "-o", f"{output_dir}/%(title)s.%(ext)s",
        "--print-json"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise Exception(result.stderr)

    data = json.loads(result.stdout.strip().split("\n")[-1])

    title = sanitize_filename(data.get("title", "audio"))
    mp3_path = os.path.join(output_dir, f"{title}.mp3")

    if not os.path.exists(mp3_path):
        raise Exception("File MP3 tidak ditemukan")

    info = {
        "title": data.get("title", "-"),
        "uploader": data.get("uploader", "-"),
        "duration": data.get("duration", 0),
        "thumbnail": data.get("thumbnail", "")
    }

    print(f"::MP3::{mp3_path}")
    print(f"::INFO::{json.dumps(info)}")

except Exception as e:
    print(f"[DOWNLOAD ERROR] {e}", file=sys.stderr)
    sys.exit(1)
