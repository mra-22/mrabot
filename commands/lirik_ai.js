import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

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
        .replace(/\s{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// ================= PRESERVE SECTION =================
function preserveSections(text) {
    return text
        .replace(/\[Verse\]/gi, "\nVERSE\n")
        .replace(/\[Chorus\]/gi, "\nCHORUS\n")
        .replace(/\[Bridge\]/gi, "\nBRIDGE\n");
}

// ================= FORMAT WA =================
function formatLyricsForWhatsApp(text) {
    const lines = text
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);

    let result = "";

    for (const line of lines) {

        const lower = line.toLowerCase();

        // section detection
        if (lower.includes("verse")) {
            result += `\n🎤 *VERSE*\n`;
            continue;
        }
        if (lower.includes("chorus")) {
            result += `\n🎶 *CHORUS*\n`;
            continue;
        }
        if (lower.includes("bridge")) {
            result += `\n🎼 *BRIDGE*\n`;
            continue;
        }

        // normal lyric
        result += `${line}\n`;
    }

    return result.trim();
}
// ================= FILTER =================
function filterLines(text) {
    return text
        .split("\n")
        .map(l => l.trim())
        .filter(l =>
            l.length > 3 &&
            !/(http|www|function|var |let |const |return)/i.test(l) &&
            !/(HOME|BERITA|VIDEO|IKLAN|COOKIE|PRIVACY)/i.test(l)
        )
        .join("\n");
}

// ================= SCRAPER =================
async function scrapeLyrics(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);
        let lyrics = "";

        // ================= GENIUS (BEST) =================
        if (url.includes("genius.com")) {
            $('[data-lyrics-container="true"]').each((i, el) => {
                lyrics += $(el).text() + "\n";
            });
        }

        // ================= KAPANLAGI =================
        else if (url.includes("kapanlagi")) {
            lyrics = $("#lirik-main-content").text();
        }

        // ================= AZLYRICS (FIX SUPER IMPORTANT) =================
        else if (url.includes("azlyrics")) {
            // ambil hanya div tengah (AZLyrics structure fix)
            $("div").each((i, el) => {
                const t = $(el).text();

                // filter keras: hanya blok lirik asli
                if (
                    t &&
                    t.length > 200 &&
                    t.length < 8000 &&
                    !t.includes("function") &&
                    !t.includes("var ") &&
                    !t.includes("cookie") &&
                    !t.includes("privacy")
                ) {
                    lyrics += t + "\n";
                }
            });
        }

        // ================= CLEAN FINAL =================
        lyrics = lyrics
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/\{[\s\S]*?\}/g, "")
            .replace(/window\..*?\n/g, "")
            .replace(/document\..*?\n/g, "")
            .replace(/Advertisement|Embed|Share/gi, "")
            .replace(/\s{3,}/g, "\n")
            .trim();

        if (lyrics.length < 80) return null;

        return lyrics;

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}
        // ================= FALLBACK AMAN (TIDAK NGACO LAGI) =================
        if (!lyrics || lyrics.length < 50) {
            const possible = [];

            $("div, p").each((i, el) => {
                const t = $(el).text().trim();

                if (
                    t.length > 40 &&
                    t.length < 2000 &&
                    !/(cookie|privacy|login|subscribe|advertisement|menu|nav)/i.test(t)
                ) {
                    possible.push(t);
                }
            });

            lyrics = possible.sort((a, b) => b.length - a.length)[0] || "";
        }

        lyrics = filterLines(lyrics);
        lyrics = cleanLyrics(lyrics);

        if (lyrics.length < 80) return null;

        return lyrics;

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}

// ================= SEARCH =================
async function searchGoogle(query) {
    try {
        const sites = [
            "kapanlagi.com",
            "genius.com",
            "azlyrics.com"
        ];

        const resultsAll = [];

        for (const site of sites) {
            const { data } = await axios.post(
                "https://google.serper.dev/search",
                {
                    q: `${query} lirik site:${site}`
                },
                {
                    headers: {
                        "X-API-KEY": process.env.SERPER_API_KEY,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (data.organic?.length) {
                resultsAll.push(...data.organic);
            }
        }

        for (const r of resultsAll) {
            const link = r.link;

            if (
                link.includes("kapanlagi") ||
                link.includes("genius") ||
                link.includes("azlyrics")
            ) {
                return link;
            }
        }

        return resultsAll[0]?.link || null;

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

    // ================= CACHE =================
    if (cache[key]) {
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

    // ================= FIX SECTION =================
    lyrics = preserveSections(lyrics);
    const formattedLyrics = formatLyricsForWhatsApp(lyrics);

    const result =
`🎶 *LIRIK DITEMUKAN*
━━━━━━━━━━━━━━
🎵 ${query}

${formattedLyrics}

━━━━━━━━━━━━━━

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
