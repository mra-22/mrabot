import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

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
        .replace(/\[.*?\]/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\n{2,}/g, "\n\n")
        .trim();
}

// ================= SEARCH MUSIXMATCH PRIORITY =================
async function searchGoogle(query) {
    try {
        const { data } = await axios.post(
            "https://google.serper.dev/search",
            { q: query + " lyrics musixmatch" },
            {
                headers: {
                    "X-API-KEY": process.env.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const results = data.organic || [];

        // 🔥 PRIORITAS MUSIXMATCH
        for (const r of results) {
            if (r.link.includes("musixmatch")) {
                console.log("[MUSIXMATCH FOUND]:", r.link);
                return r.link;
            }
        }

        // fallback
        return results[0]?.link || null;

    } catch (e) {
        console.log("[SEARCH ERROR]", e.message);
        return null;
    }
}

// ================= SCRAPE MUSIXMATCH =================
async function scrapeMusixmatch(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        $("span").each((i, el) => {
            const text = $(el).text().trim();

            if (
                text.length > 1 &&
                !text.includes("Lyrics of") &&
                !text.includes("Writer") &&
                !text.includes("Translations") &&
                !text.includes("Powered by")
            ) {
                lyrics += text + "\n";
            }
        });

        lyrics = cleanLyrics(lyrics);

        if (lyrics.length < 50) return null;

        return lyrics;

    } catch (e) {
        console.log("[MUSIXMATCH ERROR]", e.message);
        return null;
    }
}

// ================= UNIVERSAL SCRAPER =================
async function scrapeUniversal(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        // 🔥 JSON SCHEMA (powerful)
        const jsonMatch = data.match(/"lyrics":\s*{[^}]*"text":"([^"]+)"/);
        if (jsonMatch) {
            lyrics = jsonMatch[1]
                .replace(/\\n/g, "\n")
                .replace(/([a-z])([A-Z])/g, "$1\n$2");

            return cleanLyrics(lyrics);
        }

        // AZLyrics
        if (url.includes("azlyrics")) {
            lyrics = $("div.lyricsh").next().text();
        }

        // Genius
        else if (url.includes("genius")) {
            lyrics = $('[data-lyrics-container="true"]').text();
        }

        // KapanLagi
        else if (url.includes("kapanlagi")) {
            lyrics = $("#lirik-main-content").text();
        }

        // fallback universal
        if (!lyrics || lyrics.length < 50) {
            $("p, div").each((i, el) => {
                const t = $(el).text().trim();

                if (
                    t.length > 30 &&
                    t.length < 500 &&
                    !t.includes("http")
                ) {
                    lyrics += t + "\n";
                }
            });
        }

        lyrics = cleanLyrics(lyrics);

        if (lyrics.length < 50) return null;

        return lyrics;

    } catch (e) {
        console.log("[UNIVERSAL ERROR]", e.message);
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
    const url = await searchGoogle(query);

    if (!url) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan"
        }, { quoted: msg });
    }

    let lyrics = null;

    // ================= TRY MUSIXMATCH =================
    if (url.includes("musixmatch")) {
        console.log("[TRY] MUSIXMATCH");
        lyrics = await scrapeMusixmatch(url);
    }

    // ================= FALLBACK =================
    if (!lyrics) {
        console.log("[TRY] UNIVERSAL");
        lyrics = await scrapeUniversal(url);
    }

    // ================= FAIL =================
    if (!lyrics) {
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
