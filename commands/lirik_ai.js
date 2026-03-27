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

// ================= CLEAN TITLE =================
function cleanTitle(title) {
    return title
        .replace(/song and lyrics by/gi, "")
        .replace(/lyrics by/gi, "")
        .replace(/lirik/gi, "")
        .replace(/\(.*?\)/g, "")
        .replace(/\|.*$/g, "")
        .trim();
}

// ================= AI DETECT =================
function detectArtistTitle(raw, userQuery) {
    raw = cleanTitle(raw);

    let artist = "";
    let title = "";

    if (raw.includes("-")) {
        const parts = raw.split("-").map(s => s.trim());

        if (parts.length >= 2) {
            title = parts[0];
            artist = parts[1];
        }
    }

    if (!artist || !title) {
        const q = normalize(userQuery).split(" ");

        if (q.length >= 2) {
            artist = q.slice(-2).join(" ");
            title = q.slice(0, -2).join(" ");
        } else {
            title = userQuery;
        }
    }

    return {
        artist: artist.trim(),
        title: title.trim(),
        full: `${artist} ${title}`.trim()
    };
}

// ================= SERPER SEARCH =================
async function searchSongSmart(query) {
    try {
        const { data } = await axios.post(
            "https://google.serper.dev/search",
            { q: query + " lagu" },
            {
                headers: {
                    "X-API-KEY": process.env.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const results = data.organic || [];

        for (const r of results) {
            const title = r.title.toLowerCase();

            if (
                title.includes("lirik") ||
                title.includes("lyrics") ||
                title.includes("-")
            ) {
                console.log("[SERPER RAW]:", r.title);

                const detected = detectArtistTitle(r.title, query);

                console.log(
                    "[AI DETECT FIX]:",
                    detected.artist,
                    "-",
                    detected.title
                );

                return detected;
            }
        }

        return { artist: "", title: query, full: query };

    } catch (e) {
        console.log("[SERPER ERROR]", e.message);
        return { artist: "", title: query, full: query };
    }
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

// ================= GOOGLE SCRAPER =================
async function scrapeLyricsFromGoogle(query) {
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query + " lirik")}`;

        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        $("span").each((i, el) => {
            const text = $(el).text().trim();

            if (
                text.length > 15 &&
                !text.includes("Google") &&
                !text.includes("Search") &&
                !text.includes("http")
            ) {
                lyrics += text + "\n";
            }
        });

        lyrics = lyrics
            .split("\n")
            .filter(line => line.length > 5)
            .join("\n");

        return lyrics.trim() || null;

    } catch (e) {
        console.log("[GOOGLE SCRAPE ERROR]", e.message);
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

    // ================= SMART SEARCH =================
    const detected = await searchSongSmart(query);

    let lyrics = null;

    // ================= TRY 1 =================
    try {
        console.log("[TRY] lyrics-finder AI");
        lyrics = await lyricsFinder(detected.artist, detected.title);
    } catch {}

    // ================= TRY 2 =================
    if (!lyrics) {
        console.log("[TRY] full query");
        lyrics = await lyricsFinder("", detected.full);
    }

    // ================= TRY 3 =================
    if (!lyrics && detected.artist) {
        console.log("[TRY] API fallback");
        lyrics = await lyricsAPI(detected.artist, detected.title);
    }

    // ================= TRY 4 =================
    if (!lyrics) {
        console.log("[TRY] original query");
        lyrics = await lyricsFinder("", query);
    }

    // ================= TRY 5 (🔥 PENYELAMAT) =================
    if (!lyrics) {
        console.log("[TRY] GOOGLE SCRAPE");
        lyrics = await scrapeLyricsFromGoogle(
            `${detected.title} ${detected.artist}`
        );
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
🎤 ${detected.artist || "-"}
🎵 ${detected.title || query}

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
