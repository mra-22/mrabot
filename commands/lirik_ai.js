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
        .replace(/\[.*?\]/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\n{2,}/g, "\n\n")
        .trim();
}

// ================= FORMAT LYRICS =================
function formatLyrics(title, lyrics) {
    let lines = lyrics
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    let result = [];

    result.push(`Lyrics of ${title}`);
    result.push("");

    let verseCount = 1;

    for (let line of lines) {

        if (/chorus/i.test(line)) {
            result.push("chorus");
            continue;
        }

        if (/verse/i.test(line)) {
            result.push("verse");
            continue;
        }

        // auto verse grouping
        if (result.length === 2 || result[result.length - 1] === "") {
            result.push(`verse ${verseCount++}`);
        }

        result.push(line);
    }

    return result.join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// ================= SCRAPER UTAMA =================
async function scrapeLyrics(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);
        let lyrics = "";

        // ================= JSON SCHEMA =================
        const jsonMatch = data.match(/"lyrics":\s*{[^}]*"text":"([^"]+)"/);
        if (jsonMatch) {
            return cleanLyrics(
                jsonMatch[1]
                    .replace(/\\n/g, "\n")
                    .replace(/([a-z])([A-Z])/g, "$1\n$2")
            );
        }

        // ================= KAPANLAGI =================
        if (url.includes("kapanlagi")) {
            lyrics = $("#lirik-main-content")
                .html()
                ?.replace(/<br\s*\/?>/gi, "\n")
                .replace(/<\/p>/gi, "\n")
                .replace(/<[^>]+>/g, "") || "";
        }

        // ================= MUSIXMATCH =================
        else if (url.includes("musixmatch")) {
            $("span").each((i, el) => {
                let t = $(el).html();
                if (!t) return;

                t = t
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/<[^>]+>/g, "")
                    .trim();

                lyrics += t + "\n";
            });
        }

        // ================= AZLYRICS =================
        else if (url.includes("azlyrics")) {
            lyrics = $("div.lyricsh")
                .next()
                .html()
                ?.replace(/<br\s*\/?>/gi, "\n")
                .replace(/<[^>]+>/g, "") || "";
        }

        // ================= GENIUS =================
        else if (url.includes("genius")) {
            $('[data-lyrics-container="true"]').each((i, el) => {
                let html = $(el).html();
                if (!html) return;

                lyrics += html
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/<\/div>/gi, "\n")
                    .replace(/<[^>]+>/g, "") + "\n";
            });
        }

        // ================= UNIVERSAL FALLBACK =================
        if (!lyrics || lyrics.length < 50) {
            $("p, div").each((i, el) => {
                let html = $(el).html();
                if (!html) return;

                let t = html
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/<\/p>/gi, "\n")
                    .replace(/<\/div>/gi, "\n")
                    .replace(/<[^>]+>/g, "")
                    .trim();

                if (
                    t.length > 30 &&
                    t.length < 800 &&
                    !t.includes("http")
                ) {
                    lyrics += t + "\n";
                }
            });
        }

        // ================= NORMALIZE OUTPUT =================
        lyrics = lyrics
            .replace(/\r/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/([a-z])([A-Z])/g, "$1\n$2")
            .replace(/\s+\n/g, "\n")
            .trim();

        return lyrics;

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}

// ================= SEARCH =================
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

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    const cache = loadCache();
    const key = normalize(query);

    if (cache[key]) {
        return sock.sendMessage(from, {
            text: cache[key]
        }, { quoted: msg });
    }

    const url = await searchGoogle(query);

    if (!url) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan"
        }, { quoted: msg });
    }

    let lyrics = await scrapeLyrics(url);

    if (!lyrics) {
        return sock.sendMessage(from, {
            text: `❌ Lirik tidak ditemukan\n\n🔎 Query: ${query}`
        }, { quoted: msg });
    }

    const formattedLyrics = formatLyrics(query, lyrics);

    const result =
`🎶 LIRIK DITEMUKAN
━━━━━━━━━━━━━━

${formattedLyrics}`;

    cache[key] = result;
    saveCache(cache);

    await sock.sendMessage(from, {
        text: result
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
