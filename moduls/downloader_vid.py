import sys
import yt_dlp
import os
import uuid
import subprocess
import platform

def convert_to_mp4(input_path):
    base = os.path.splitext(input_path)[0]
    output_path = base + ".mp4"

    try:
        kwargs = { "check": True }
        if platform.system() == "Windows":
            kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW

        subprocess.run([
            "ffmpeg", "-y", "-i", input_path,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            output_path
        ], **kwargs)

        return output_path
    except subprocess.CalledProcessError:
        return None

def main():
    if len(sys.argv) < 2:
        print("No query provided", file=sys.stderr)
        sys.exit(1)

    query = sys.argv[1]

    output_dir = "./videos"
    os.makedirs(output_dir, exist_ok=True)

    filename = str(uuid.uuid4()) + ".%(ext)s"
    output_path = os.path.join(output_dir, filename)

    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'outtmpl': output_path,
        'quiet': True,
        'noplaylist': True,
       'js_runtimes': {
            'node': {
        'path': 'C:\\Program Files\\nodejs\\node.exe'
            }
        }
    }

    try:
        with yt_dlp.YoutubeDL({
            'quiet': True,
            'js_runtimes': {
                'node': {
                    'path': 'C:\\Program Files\\nodejs\\node.exe'
                }
            }
        }) as ydl:
            # 🔎 SEARCH 10 VIDEO
            search = ydl.extract_info(f"ytsearch10:{query} shorts", download=False)

        entries = search.get("entries", [])

        short_video = None

        for vid in entries:
            duration = vid.get("duration", 0)

            if duration and duration <= 90:
                short_video = vid
                break

        if not short_video:
            print("❌ Tidak ditemukan video pendek", file=sys.stderr)
            sys.exit(1)

        video_url = short_video.get("webpage_url")

        # 📥 DOWNLOAD VIDEO TERPILIH
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            downloaded_path = ydl.prepare_filename(info)

        if not downloaded_path.endswith(".mp4"):
            converted = convert_to_mp4(downloaded_path)
            if converted:
                print("[VIDDONE]" + os.path.abspath(converted))
            else:
                print("Conversion failed", file=sys.stderr)
                sys.exit(1)
        else:
            print("[VIDDONE]" + os.path.abspath(downloaded_path))

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()