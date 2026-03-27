import axios from "axios";
import * as cheerio from "cheerio";
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
        .replace(/Advertisement/gi, "")
        .replace(/Embed|Share|Copy/gi, "")
        .replace(/\{.*?\}/g, "")
        .replace(/@context|schema\.org/gi, "")
        .replace(/\[.*?\]/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\n{2,}/g, "\n\n")
        .replace(/Performance Cookies/gi, "")
        .replace(/Targeting Cookies/gi, "")
        .replace(/Consent/gi, "")
        .replace(/checkbox label/gi, "")
        .replace(/Leg\.Interest/gi, "")
        .trim();
}

// ================= FILTER =================
function filterLines(text) {
    return text
        .split("\n")
        .map(l => l.trim())
        .filter(l =>
            l.length > 3 &&

            // ❌ buang sampah musixmatch
            !l.match(/(cookie|consent|label|privacy|terms|leg\.interest)/i) &&

            // ❌ buang web junk
            !l.match(/(http|www|function|var |let |const |return)/i) &&

            // ❌ buang menu web indo
            !l.match(/(HOME|BERITA|VIDEO|IKLAN)/i)
        )
        .join("\n");
}

// ================= SERPER SEARCH =================
async function searchGoogle(query) {
    try {
        const { data } = await axios.post(
            "https://google.serper.dev/search",
            { q: query + " lirik lagu musixmatch" },
            {
                headers: {
                    "X-API-KEY": process.env.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const results = data.organic || [];

        let musix = null;
        let fallback = null;

        for (const r of results) {
            const link = r.link;

            if (link.includes("musixmatch") && !musix) {
                musix = link;
            }

            if (
                (link.includes("kapanlagi") ||
                 link.includes("azlyrics") ||
                 link.includes("genius")) &&
                !fallback
            ) {
                fallback = link;
            }
        }

        console.log("[MUSIX URL]:", musix);
        console.log("[FALLBACK URL]:", fallback);

        return { musix, fallback };

    } catch (e) {
        console.log("[SEARCH ERROR]", e.message);
        return {};
    }
}

// ================= PLAYWRIGHT MUSIXMATCH =================
async function scrapeMusixmatch(url) {
    let browser;

    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        // tunggu muncul lirik (selector lebih fleksibel)
        await page.waitForSelector("div[class*=Lyrics__Container], span", {
            timeout: 20000
        });

        // auto scroll biar full lirik kebuka
        await page.evaluate(async () => {
            await new Promise(resolve => {
                let total = 0;
                let distance = 500;

                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    total += distance;

                    if (total >= document.body.scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        });

        // ambil semua teks
       const lyrics = await page.evaluate(() => {
            let text = "";
        
            // ✅ fokus ke container lirik asli musixmatch
            const containers = document.querySelectorAll(
                "div[class*='Lyrics__Container'] p, div[class*='Lyrics__Container'] span"
            );
        
            containers.forEach(el => {
                const t = el.innerText?.trim();
        
                if (
                    t &&
                    t.length > 2 &&
                    !t.match(/cookie|consent|label|advert|privacy|terms/i)
                ) {
                    text += t + "\n";
                }
            });
        
            return text;
        });

        await browser.close();

        return filterLines(cleanLyrics(lyrics));

    } catch (e) {
        console.log("[PLAYWRIGHT ERROR]", e.message);
        if (browser) await browser.close();
        return null;
    }
}

// ================= FALLBACK SCRAPER =================
async function scrapeFallback(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        if (url.includes("kapanlagi")) {
            lyrics = $("#lirik-main-content").text();
        } else if (url.includes("azlyrics")) {
            lyrics = $("div.lyricsh").next().text();
        } else if (url.includes("genius")) {
            lyrics = $('[data-lyrics-container="true"]').text();
        }

        if (!lyrics || lyrics.length < 50) {
            $("p").each((i, el) => {
                const t = $(el).text().trim();
                if (t.length > 30) lyrics += t + "\n";
            });
        }

        return filterLines(cleanLyrics(lyrics));

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
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
    const { musix, fallback } = await searchGoogle(query);

    let lyrics = null;

    // ================= PRIORITAS MUSIXMATCH =================
    if (musix) {
        console.log("[TRY] MUSIXMATCH PLAYWRIGHT");
        lyrics = await scrapeMusixmatch(musix);
    }

    // ================= FALLBACK =================
    if (!lyrics && fallback) {
        console.log("[TRY] FALLBACK SCRAPER");
        lyrics = await scrapeFallback(fallback);
    }

    // ================= FAIL =================
    if (!lyrics || lyrics.length < 50) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan

🔎 Query: ${query}

💡 Tips:
- tambah artis
- contoh: bahagia lagi piche kota`
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
