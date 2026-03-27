import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

// ================= NORMALIZE =================
function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

// ================= CLEAN GLOBAL =================
function cleanLyrics(text) {
    return text
        .replace(/Advertisement/gi, "")
        .replace(/Embed|Share|Copy/gi, "")
        .replace(/\{.*?\}/g, "")
        .replace(/@context|schema\.org/gi, "")
        .replace(/\[.*?\]/g, "") // hapus [Verse]
        .replace(/\s{2,}/g, " ")
        .replace(/\n{2,}/g, "\n\n")
        .trim();
}

// ================= UNIVERSAL FILTER =================
function filterLines(text) {
    return text
        .split("\n")
        .map(l => l.trim())
        .filter(l =>
            l.length > 3 &&
            !l.match(/(http|www|function|var |let |const |return)/i) &&
            !l.match(/(HOME|BERITA|VIDEO|IKLAN)/i)
        )
        .join("\n");
}

// ================= SCRAPER UTAMA =================
async function scrapeLyrics(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        // ================= 1. JSON SCHEMA =================
        const jsonMatch = data.match(/"lyrics":\s*{[^}]*"text":"([^"]+)"/);
        if (jsonMatch) {
            lyrics = jsonMatch[1]
                .replace(/\\n/g, "\n")
                .replace(/([a-z])([A-Z])/g, "$1\n$2");
            return cleanLyrics(lyrics);
        }

        // ================= 2. SITE KHUSUS =================

        // KapanLagi
        if (url.includes("kapanlagi")) {
            lyrics = $("#lirik-main-content").text();
        }

        // Musixmatch
        else if (url.includes("musixmatch")) {
            $("span").each((i, el) => {
                const t = $(el).text().trim();
                if (t.length > 1) lyrics += t + "\n";
            });
        }

        // AZLyrics
        else if (url.includes("azlyrics")) {
            lyrics = $("div.lyricsh").next().text();
        }

        // Genius
        else if (url.includes("genius")) {
            lyrics = $('[data-lyrics-container="true"]').text();
        }

        // ================= 3. UNIVERSAL FALLBACK =================
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

        lyrics = filterLines(lyrics);
        lyrics = cleanLyrics(lyrics);

        if (lyrics.length < 50) return null;

        return lyrics;

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}

// ================= SEARCH SERPER =================
async function searchGoogle(query) {
    try {
        const { data } = await axios.post(
            "https://google.serper.dev/search",
            { q: query + " lirik lagu" },
            {
                headers: {
                    "X-API-KEY": process.env.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const results = data.organic || [];

        for (const r of results) {
            const link = r.link;

            if (
                link.includes("kapanlagi") ||
                link.includes("musixmatch") ||
                link.includes("azlyrics") ||
                link.includes("genius")
            ) {
                console.log("[URL FOUND]:", link);
                return link;
            }
        }

        return results[0]?.link || null;

    } catch (e) {
        console.log("[SEARCH ERROR]", e.message);
        return null;
    }
}

// ================= CACHE =================
const CACHE_FILE = "./database/lirik_cache.json";

function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE));
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
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

    // ================= SCRAPE =================
    let lyrics = await scrapeLyrics(url);

    // ================= FAIL =================
    if (!lyrics) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan

🔎 Query: ${query}

💡 Coba:
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
