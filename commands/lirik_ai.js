import axios from "axios";
import fs from "fs";
import { chromium } from "playwright";

// ================= CONFIG =================
const CACHE_FILE = "./database/lirik_cache.json";

// ================= CACHE =================
function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE));
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ================= NORMALIZE =================
function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

// ================= CLEAN =================
function cleanLyrics(text) {
    return text
        .replace(/\[.*?\]/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\n{2,}/g, "\n\n")
        .trim();
}

// ================= SEARCH MUSIXMATCH =================
async function searchMusixmatch(query) {
    try {
        const { data } = await axios.post(
            "https://google.serper.dev/search",
            {
                q: `${query} site:musixmatch.com lyrics`
            },
            {
                headers: {
                    "X-API-KEY": process.env.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const results = data.organic || [];

        for (const r of results) {
            if (r.link.includes("musixmatch.com")) {
                return r.link;
            }
        }

        return null;

    } catch (e) {
        console.log("[SEARCH ERROR]", e.message);
        return null;
    }
}

// ================= PLAYWRIGHT SCRAPER =================
async function scrapeMusixmatch(url) {
    let browser;

    try {
        // 🔥 FIX URL (hapus /ko /id dll)
        url = url.replace(/musixmatch\.com\/[a-z]{2}\//, "musixmatch.com/");

        console.log("[PLAYWRIGHT URL]:", url);

        browser = await chromium.launch({
            headless: true,
        });

        const page = await browser.newPage();

        await page.setExtraHTTPHeaders({
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        });

        await page.goto(url, { waitUntil: "domcontentloaded" });

        // ================= AUTO SCROLL =================
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 300;

                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= document.body.scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        });

        // tunggu container lirik
        await page.waitForSelector("div[class*='Lyrics__Container']", {
            timeout: 10000,
        });

        // ================= AMBIL LIRIK =================
        const lyrics = await page.$$eval(
            "div[class*='Lyrics__Container']",
            (els) =>
                els
                    .map((el) => el.innerText)
                    .join("\n")
        );

        await browser.close();

        if (!lyrics || lyrics.length < 50) return null;

        return cleanLyrics(lyrics);

    } catch (e) {
        if (browser) await browser.close();
        console.log("[PLAYWRIGHT ERROR]", e.message);
        return null;
    }
}

// ================= MAIN =================
export async function lirik(sock, msg, from, sender, cmd, args) {

    const query = args.join(" ").trim();

    if (!query) {
        return sock.sendMessage(from, {
            text: "Contoh: !lirik bahagia lagi"
        }, { quoted: msg });
    }

    console.log("[LIRIK RAW]:", query);

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    const cache = loadCache();
    const key = normalize(query);

    // ================= CACHE =================
    if (cache[key]) {
        console.log("[CACHE HIT]");
        return sock.sendMessage(from, {
            text: cache[key]
        }, { quoted: msg });
    }

    // ================= SEARCH =================
    const url = await searchMusixmatch(query);

    if (!url) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan"
        }, { quoted: msg });
    }

    console.log("[MUSIX URL]:", url);

    // ================= SCRAPE =================
    let lyrics = await scrapeMusixmatch(url);

    // ================= FAIL =================
    if (!lyrics) {
        return sock.sendMessage(from, {
            text:
`❌ Gagal ambil lirik dari Musixmatch

🔎 Query: ${query}

💡 Coba tambah artis
contoh: bahagia lagi piche kota`
        }, { quoted: msg });
    }

    const result =
`🎶 LIRIK DITEMUKAN
━━━━━━━━━━━━━━
🎵 ${query}

${lyrics}`;

    // ================= SAVE CACHE =================
    cache[key] = result;
    saveCache(cache);

    await sock.sendMessage(from, {
        text: result
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
