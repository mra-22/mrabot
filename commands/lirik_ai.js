import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

// ================= NORMALIZE =================
function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

// ================= CLEAN SUPER =================
function cleanLyrics(text) {
    return text
        .replace(/Advertisement/gi, "")
        .replace(/Embed|Share|Copy/gi, "")
        .replace(/\{.*?\}/gs, "")
        .replace(/@context|schema\.org/gi, "")
        .replace(/function\(.*?\)/gs, "")
        .replace(/window\..*/g, "")
        .replace(/document\..*/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/http\S+/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\n{2,}/g, "\n\n")
        .trim();
}

// ================= FILTER LINE =================
function filterLines(text) {
    return text
        .split("\n")
        .map(l => l.trim())
        .filter(l =>
            l.length > 5 &&
            !l.match(/(http|www|var |let |const |return)/i) &&
            !l.match(/(HOME|BERITA|VIDEO|IKLAN|Advertisement)/i)
        )
        .join("\n");
}

// ================= MUSIXMATCH SCRAPER (PRIORITAS) =================
async function scrapeMusixmatch(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        // 🔥 selector terbaru musixmatch
        $("div[class*='Lyrics__Container']").each((i, el) => {
            const html = $(el).html();

            if (html) {
                const text = html
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/<\/?[^>]+(>|$)/g, "");

                lyrics += text + "\n";
            }
        });

        // fallback lama
        if (!lyrics || lyrics.length < 50) {
            $("span").each((i, el) => {
                const t = $(el).text().trim();
                if (t.length > 1) lyrics += t + "\n";
            });
        }

        lyrics = filterLines(lyrics);
        lyrics = cleanLyrics(lyrics);

        if (lyrics.length < 50) return null;

        return lyrics;

    } catch (e) {
        console.log("[MUSIXMATCH ERROR]", e.message);
        return null;
    }
}

// ================= SCRAPER UNIVERSAL =================
async function scrapeUniversal(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        // JSON schema (PALING AKURAT)
        const jsonMatch = data.match(/"lyrics":\s*{[^}]*"text":"([^"]+)"/);
        if (jsonMatch) {
            lyrics = jsonMatch[1]
                .replace(/\\n/g, "\n")
                .replace(/([a-z])([A-Z])/g, "$1\n$2");

            return cleanLyrics(lyrics);
        }

        // KapanLagi
        if (url.includes("kapanlagi")) {
            lyrics = $("#lirik-main-content").text();
        }

        // Genius
        else if (url.includes("genius")) {
            lyrics = $('[data-lyrics-container="true"]').text();
        }

        // AZLyrics
        else if (url.includes("azlyrics")) {
            lyrics = $("div.lyricsh").next().text();
        }

        // fallback global
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

// ================= SEARCH GOOGLE =================
async function searchGoogle(query) {
    try {
        const { data } = await axios.post(
            "https://google.serper.dev/search",
            {
                q: `${query} musixmatch lyrics`
            },
            {
                headers: {
                    "X-API-KEY": process.env.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const results = data.organic || [];

        let musix = null;
        let other = null;

        for (const r of results) {
            if (r.link.includes("musixmatch") && !musix) {
                musix = r.link;
            }

            if (
                (r.link.includes("kapanlagi") ||
                 r.link.includes("genius") ||
                 r.link.includes("azlyrics")) &&
                !other
            ) {
                other = r.link;
            }
        }

        console.log("[MUSIX URL]:", musix);
        console.log("[FALLBACK URL]:", other);

        return { musix, other };

    } catch (e) {
        console.log("[SEARCH ERROR]", e.message);
        return {};
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

    if (cache[key]) {
        console.log("[CACHE HIT]");
        return sock.sendMessage(from, {
            text: cache[key]
        }, { quoted: msg });
    }

    // ================= SEARCH =================
    const { musix, other } = await searchGoogle(query);

    let lyrics = null;

    // ================= PRIORITAS MUSIXMATCH =================
    if (musix) {
        console.log("[TRY] MUSIXMATCH");
        lyrics = await scrapeMusixmatch(musix);
    }

    // ================= FALLBACK =================
    if (!lyrics && other) {
        console.log("[TRY] FALLBACK SITE");
        lyrics = await scrapeUniversal(other);
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

    cache[key] = result;
    saveCache(cache);

    await sock.sendMessage(from, {
        text: result
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
