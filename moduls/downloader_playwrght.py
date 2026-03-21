import sys
import os
import re
import uuid
import subprocess

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "_", name)

def download_with_ytdlp(url):
    try:
        import yt_dlp
    except ImportError:
        print("❌ [VIDERROR] yt-dlp tidak ditemukan. Install dengan: pip install yt-dlp")
        return None

    output_template = f"output_{uuid.uuid4().hex[:6]}.%(ext)s"
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'outtmpl': output_template,
        'quiet': True,
        'noplaylist': True,
        'merge_output_format': 'mp4'
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            file_path = ydl.prepare_filename(info)
            return file_path
    except Exception as e:
        print(f"❌ [VIDERROR] yt-dlp gagal untuk {url}: {str(e)}")
        return None

def download_with_playwright(url):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("❌ [VIDERROR] Playwright tidak ditemukan. Install dengan: pip install playwright")
        return None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            page.goto(url, timeout=20000)

            page.wait_for_selector("video", timeout=15000)
            video_src = page.locator("video").get_attribute("src")
            if not video_src:
                video_src = page.locator("video > source").get_attribute("src")

            if not video_src or video_src.startswith("/"):
                print(f"❌ [VIDERROR] Video source tidak valid di {url}")
                return None

            filename = sanitize_filename(f"video_{uuid.uuid4().hex[:6]}.mp4")
            raw_path = f"temp_{filename}"
            final_path = f"output_{filename}"

            subprocess.run(["curl", "-L", video_src, "-o", raw_path], check=True)

            # ✅ PERBAIKAN: Gunakan Popen + creationflags untuk Windows
            CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0

            ffmpeg_process = subprocess.Popen([
                "ffmpeg", "-y", "-i", raw_path,
                "-c:v", "libx264", "-preset", "fast", "-crf", "28",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                final_path
            ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=CREATE_NO_WINDOW
            )
            ffmpeg_process.wait()

            os.remove(raw_path)
            return final_path

        except Exception as e:
            print(f"❌ [VIDERROR] Playwright error di {url}: {str(e)}")
            return None
        finally:
            context.close()
            browser.close()

def handle_single_url(url):
    print(f"🔗 Mengunduh: {url}")
    file = download_with_ytdlp(url)
    if not file or not os.path.exists(file):
        print("⚠️ yt-dlp gagal, mencoba Playwright...")
        file = download_with_playwright(url)

    if file and os.path.exists(file):
        print(f"👉 [VIDDONE]{file}")
    else:
        print("❌ [VIDERROR] Gagal unduh dari: " + url)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ [VIDERROR] URL tidak ditemukan")
        sys.exit(1)

    urls = sys.argv[1:]
    for u in urls:
        handle_single_url(u.strip())
