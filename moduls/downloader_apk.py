import sys, os, re, json, time, requests
from bs4 import BeautifulSoup

APP_NAME = " ".join(sys.argv[1:])
BASE = os.path.dirname(os.path.abspath(__file__))
APK_DIR = os.path.join(BASE, "..", "apks")
CACHE_FILE = os.path.join(BASE, "cache.json")
MAX_MB = 100

os.makedirs(APK_DIR, exist_ok=True)
headers = {"User-Agent": "Mozilla/5.0"}

# ================= UTIL =================

def sanitize(n):
    return re.sub(r'[^a-zA-Z0-9._-]', '_', n).lower()

def load_cache():
    return json.load(open(CACHE_FILE)) if os.path.exists(CACHE_FILE) else {}

def save_cache(data):
    json.dump(data, open(CACHE_FILE, "w"), indent=2)

def head_size(url):
    try:
        r = requests.head(url, headers=headers, timeout=10, allow_redirects=True)
        return int(r.headers.get("Content-Length", 0))
    except:
        return 0

# ================= SOURCES =================

def uptodown(app):
    try:
        s = requests.get(
            f"https://en.uptodown.com/android/search/{app.replace(' ', '%20')}",
            headers=headers, timeout=15
        )
        soup = BeautifulSoup(s.text, "html.parser")
        a = soup.select_one("a.app-card")
        if not a: return None

        page = "https://en.uptodown.com" + a["href"]
        p = requests.get(page, headers=headers)
        soup = BeautifulSoup(p.text, "html.parser")
        d = soup.select_one("a#detail-download-button")
        return d["href"] if d else None
    except:
        return None

def apkmirror(app):
    try:
        s = requests.get(
            f"https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s={app}",
            headers=headers
        )
        soup = BeautifulSoup(s.text, "html.parser")
        link = soup.select_one("a.downloadLink")
        return "https://www.apkmirror.com" + link["href"] if link else None
    except:
        return None

def apkpure(app):
    try:
        s = requests.get(
            f"https://apkpure.com/search?q={app.replace(' ', '+')}",
            headers=headers
        )
        soup = BeautifulSoup(s.text, "html.parser")
        a = soup.select_one("a.apk-name")
        if not a: return None
        return "https://apkpure.com" + a["href"] + "/download"
    except:
        return None

# ================= MAIN =================

if not APP_NAME:
    print("ERROR|Nama aplikasi kosong")
    sys.exit(1)

cache = load_cache()
key = sanitize(APP_NAME)

if key in cache and os.path.exists(cache[key]["path"]):
    print(cache[key]["path"])
    sys.exit(0)

sources = {
    "uptodown": uptodown,
    "apkmirror": apkmirror,
    "apkpure": apkpure
}

candidates = []

for name, fn in sources.items():
    url = fn(APP_NAME)
    if not url: continue
    size = head_size(url)
    if size == 0: continue
    candidates.append((size, name, url))

if not candidates:
    print("ERROR|Tidak ada sumber valid")
    sys.exit(1)

# pilih paling kecil & cepat
candidates.sort()
size, src, url = candidates[0]

if size > MAX_MB * 1024 * 1024:
    print(f"ERROR|File terlalu besar ({size//1024//1024} MB)")
    sys.exit(1)

# download
filename = key + ".apk"
path = os.path.join(APK_DIR, filename)

r = requests.get(url, headers=headers, stream=True)
with open(path, "wb") as f:
    for chunk in r.iter_content(1024 * 64):
        f.write(chunk)

cache[key] = {
    "source": src,
    "size": size,
    "path": path,
    "time": time.time()
}
save_cache(cache)

print(path)
