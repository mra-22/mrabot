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

// ================= EXTRACT ARTIST =================
function extractArtistFromQuery(query) {
    const parts = query.split(" ");
    if (parts.length >= 2) return parts.slice(-2).join(" ");
    return "-";
}

// ================= FORMAT WA =================
function formatLyricsWA(lyrics, title, artist) {
    lyrics = lyrics
        .replace(/\r/g, "")
        .replace(/\n{2,}/g, "\n\n")
        .trim();

    let lines = lyrics.split("\n")
        .map(l => l.trim())
        .filter(l =>
            l.length > 0 &&
            !l.match(/(unconditional|devotion|cookies|label)/i)
        );

    let result = "";
    let bait = [];

    for (let i = 0; i < lines.length; i++) {
        bait.push(lines[i]);

        if (bait.length >= 4) {
            result += bait.join("\n") + "\n\n";
            bait = [];
        }
    }

    if (bait.length) result += bait.join("\n") + "\n\n";

    return `🎶 *${title}*
━━━━━━━━━━━━━━
🎤 ${artist}

${result.trim()}
━━━━━━━━━━━━━━
✨ Powered by Bot`;
}

// ================= CLEAN =================
function cleanLyrics(text) {
    return text
        .replace(/Advertisement/gi, "")
        .replace(/Embed|Share|Copy/gi, "")
        .replace(/\{.*?\}/g, "")
        .replace(/\[.*?\]/g, "")
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
            l.length > 2 &&
            !l.match(/(cookie|consent|label|privacy|terms)/i) &&
            !l.match(/(unconditional|devotion|spiritual)/i) &&
            !l.match(/(http|www|function|var |let |const)/i)
        )
        .join("\n");
}

// ================= SEARCH =================
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

            if (link.includes("musixmatch") && !musix) musix = link;

            if (
                (link.includes("kapanlagi") ||
                 link.includes("azlyrics") ||
                 link.includes("genius")) &&
                !fallback
            ) {
                fallback = link;
            }
        }

        console.log("[MUSIX]:", musix);
        console.log("[FALLBACK]:", fallback);

        return { musix, fallback };

    } catch (e) {
        console.log("[SEARCH ERROR]", e.message);
        return {};
    }
}

// ================= MUSIXMATCH PLAYWRIGHT =================
async function scrapeMusixmatch(url) {
    let browser;

    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        await page.waitForSelector("div[class*='Lyrics__Container']", {
            timeout: 30000
        });

        // scroll
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

        const lyrics = await page.evaluate(() => {
            let text = "";

            const blocks = document.querySelectorAll(
                "div[class*='Lyrics__Container']"
            );

            blocks.forEach(block => {
                const lines = block.innerText.split("\n");

                lines.forEach(l => {
                    const t = l.trim();

                    if (
                        t &&
                        t.length > 2 &&
                        !t.match(/(cookie|consent|label|advert|privacy|terms)/i) &&
                        !t.match(/(unconditional|devotion|spiritual)/i)
                    ) {
                        text += t + "\n";
                    }
                });
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

// ================= FALLBACK =================
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

        return filterLines(cleanLyrics(lyrics));

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}

// ================= SPLIT WA =================
function splitMessage(text, limit = 3500) {
    let parts = [];
    for (let i = 0; i < text.length; i += limit) {
        parts.push(text.substring(i, i + limit));
    }
    return parts;
}

// ================= MAIN =================
export async function lirik(sock, msg, from, sender, cmd, args) {

    const query = args.join(" ").trim();

    if (!query) {
        return sock.sendMessage(from, {
            text: "Contoh: .lirik bahagia lagi"
        }, { quoted: msg });
    }

    console.log("[LIRIK RAW]:", query);

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    const cache = loadCache();
    const key = normalize(query);

    if (cache[key]) {
        console.log("[CACHE HIT]");
        return sock.sendMessage(from, {
            text: cache[key]
        }, { quoted: msg });
    }

    const { musix, fallback } = await searchGoogle(query);

    let lyrics = null;

    if (musix) {
        console.log("[TRY] MUSIXMATCH");
        lyrics = await scrapeMusixmatch(musix);
    }

    if (!lyrics && fallback) {
        console.log("[TRY] FALLBACK");
        lyrics = await scrapeFallback(fallback);
    }

    if (!lyrics || lyrics.length < 50) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan

🔎 Query: ${query}

💡 Contoh:
bahagia lagi piche kota`
        }, { quoted: msg });
    }

    const artist = extractArtistFromQuery(query);

    const result = formatLyricsWA(lyrics, query, artist);

    cache[key] = result;
    saveCache(cache);

    const parts = splitMessage(result);

    for (let p of parts) {
        await sock.sendMessage(from, { text: p }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
