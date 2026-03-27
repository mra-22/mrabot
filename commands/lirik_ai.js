import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import lyricsFinder from "lyrics-finder";

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
    return text
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|mv/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// ================= API FALLBACK =================
async function lyricsAPI(artist, title) {
    try {
        const url = `https://api.lyrics.ovh/v1/${artist}/${title}`;
        const { data } = await axios.get(url);
        return data?.lyrics || null;
    } catch {
        return null;
    }
}

// ================= SERPER (AMBIL LINK) =================
async function searchSongSmart(query) {
    try {
        const { data } = await axios.post(
            "https://google.serper.dev/search",
            { q: query + " lirik" },
            {
                headers: {
                    "X-API-KEY": process.env.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const results = data.organic || [];

        for (const r of results) {
            const link = r.link || "";

            // 🔥 prioritas website lirik
            if (
                link.includes("kapanlagi") ||
                link.includes("musixmatch") ||
                link.includes("lirik") ||
                link.includes("lyrics")
            ) {
                console.log("[SERPER LINK]:", link);
                return link;
            }
        }

        return null;

    } catch (e) {
        console.log("[SERPER ERROR]", e.message);
        return null;
    }
}

// ================= SCRAPE WEBSITE =================
async function scrapeFromWebsite(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        // 🔥 ambil semua text panjang
        $("p, div").each((i, el) => {
            const text = $(el).text().trim();

            if (
                text.length > 20 &&
                !text.includes("ADVERTISEMENT") &&
                !text.includes("Baca juga") &&
                !text.includes("Lihat juga")
            ) {
                lyrics += text + "\n";
            }
        });

        lyrics = lyrics
            .split("\n")
            .filter(l => l.length > 5)
            .join("\n");

        return lyrics || null;

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
            text: "Contoh: !lirik bahagia lagi piche kota"
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

    let lyrics = null;

    // ================= TRY 1 =================
    try {
        console.log("[TRY] lyrics-finder");
        lyrics = await lyricsFinder("", query);
    } catch {}

    // ================= TRY 2 =================
    const link = await searchSongSmart(query);

    if (!lyrics && link) {
        console.log("[TRY] SCRAPE WEBSITE");
        lyrics = await scrapeFromWebsite(link);
    }

    // ================= TRY 3 =================
    if (!lyrics) {
        console.log("[TRY] API fallback");
        lyrics = await lyricsAPI("", query);
    }

    // ================= FAIL =================
    if (!lyrics) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan

🔎 Query: ${query}

💡 Coba:
- bahagia lagi piche kota
- ijuk iyeth bustami`
        }, { quoted: msg });
    }

    lyrics = lyrics
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

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
