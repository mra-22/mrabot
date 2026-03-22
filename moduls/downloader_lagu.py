import sys
import os
import re
import subprocess
import json
from yt_dlp import YoutubeDL
from playwright.sync_api import sync_playwright

if len(sys.argv) < 2:
    print("[DOWNLOAD ERROR] Judul lagu tidak diberikan", file=sys.stderr)
    sys.exit(1)

query = " ".join(sys.argv[1:])
output_dir = "audios"
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
                "-i", input_path,
                "-vn",
                "-acodec", "libmp3lame",
                "-b:a", "128k",
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


# 🔥 AMBIL VIDEO VIA BROWSER (ANTI BLOCK)
def get_video_url(query):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(f"https://www.youtube.com/results?search_query={query}")

        page.wait_for_selector("ytd-video-renderer", timeout=10000)

        video = page.query_selector("ytd-video-renderer a#video-title")

        if not video:
            browser.close()
            raise Exception("Tidak menemukan video")

        url = video.get_attribute("href")
        title = video.get_attribute("title")

        browser.close()

        return "https://www.youtube.com" + url, title


try:
    # ================= SEARCH VIA PLAYWRIGHT =================
    video_url, raw_title = get_video_url(query)

    title = sanitize_filename(raw_title or "audio")
    output_path = os.path.join(output_dir, f"{title}.mp4")

    # ================= DOWNLOAD (PAKAI yt-dlp TETAP) =================
    ydl_opts_download = {
        "format": "bestaudio/best",
        "quiet": True,
        "outtmpl": output_path,
        "noplaylist": True,
    }

    with YoutubeDL(ydl_opts_download) as ydl:
        info = ydl.extract_info(video_url, download=True)

    if not os.path.exists(output_path):
        raise Exception("File video tidak ditemukan setelah download")

    # ================= CONVERT =================
    mp3_path = convert_to_mp3(output_path)

    if not mp3_path or not os.path.exists(mp3_path):
        raise Exception("Gagal konversi ke MP3")

    # ================= OUTPUT =================
    info_data = {
        "title": info.get("title", "-"),
        "uploader": info.get("uploader", "-"),
        "duration": info.get("duration", 0),
        "thumbnail": info.get("thumbnail", "")
    }

    print(f"::MP3::{mp3_path}")
    print(f"::INFO::{json.dumps(info_data)}")

except Exception as e:
    print(f"[DOWNLOAD ERROR] {e}", file=sys.stderr)
    sys.exit(1)
