import sys
import subprocess
import os
import json
import requests
from bs4 import BeautifulSoup

def run_yt_dlp(url):
    """Coba download pakai yt-dlp, return (success, stdout, stderr)"""
    try:
        result = subprocess.run(
            ["yt-dlp", "-f", "best", "-o", "videos/%(title)s.%(ext)s", "--print-json", url],
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0 and result.stdout.strip():
            # Parsing JSON info yt-dlp
            info_json = json.loads(result.stdout.strip().split('\n')[-1])
            file_path = f"videos/{info_json['title']}.{info_json['ext']}"
            print(file_path)
            print("::INFO::" + json.dumps({
                "title": info_json.get("title"),
                "uploader": info_json.get("uploader"),
                "view_count": info_json.get("view_count")
            }))
            return True
        else:
            print("[YTDLP ERROR]", result.stderr)
            return False
    except Exception as e:
        print("[YTDLP EXCEPTION]", e)
        return False

def fallback_pinterest_image(url):
    """Fallback ambil og:image dari pinterest"""
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        print("[FALLBACK ERROR] Tidak bisa akses halaman:", resp.status_code)
        return False

    soup = BeautifulSoup(resp.text, "html.parser")
    og_image = soup.find("meta", property="og:image")
    if not og_image:
        print("[FALLBACK ERROR] Tidak menemukan og:image di HTML")
        return False

    image_url = og_image.get("content")
    img_data = requests.get(image_url, headers=headers).content
    os.makedirs("videos", exist_ok=True)
    file_path = os.path.join("videos", "pinterest_image.jpg")
    with open(file_path, "wb") as f:
        f.write(img_data)
    print(file_path)
    print("::INFO::" + json.dumps({
        "title": "Pinterest Image",
        "uploader": "-",
        "view_count": 0
    }))
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pinterest_downloader.py <url>")
        sys.exit(1)

    url = sys.argv[1]

    # Coba yt-dlp dulu
    success = run_yt_dlp(url)
    if not success:
        # Kalau gagal, fallback ke og:image
        fallback_pinterest_image(url)
