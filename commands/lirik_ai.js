import fs from "fs";
import axios from "axios";
import lyricsFinder from "lyrics-finder";

// ================= CONFIG =================
const CACHE_FILE = "./database/lirik_cache.json";

// ================= LOAD CACHE =================
function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE));
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ================= DATABASE LAGU INDO =================
const DB_LAGU = {
    "bahagia lagi": "Piche Kota Bahagia Lagi",
    "komang": "Raim Laode Komang",
    "hati hati di jalan": "Tulus Hati Hati Di Jalan",
    "melukis senja": "Budi Doremi Melukis Senja",
    "sial": "Mahalini Sial",
    "tak ingin usai": "Keisya Levronka Tak Ingin Usai",
};

// ================= NORMALIZE =================
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|mv/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .trim();
}

// ================= SERPER SEARCH =================
async function searchSongSmart(query) {
    try {
        const { data } = await axios.post(
            "https://google.serper.dev/search",
            {
                q: query + " lagu",
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
            const title = r.title.toLowerCase();

            if (
                title.includes("lirik") ||
                title.includes("lyrics") ||
                title.includes("-")
            ) {
                console.log("[SERPER FOUND]:", r.title);

                return r.title
                    .replace(/lirik|lyrics/gi, "")
                    .trim();
            }
        }

        return query;
    } catch (e) {
        console.log("[SERPER ERROR]", e.message);
        return query;
    }
}

// ================= API FALLBACK =================
async function lyricsAPI(query) {
    try {
        const parts = query.split(" ");
        const artist = parts[0];
        const title = parts.slice(1).join(" ");

        const url = `https://api.lyrics.ovh/v1/${artist}/${title}`;
        const { data } = await axios.get(url);

        return data?.lyrics || null;
    } catch {
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

    // ================= CACHE =================
    const cache = loadCache();
    const key = normalize(query);

    if (cache[key]) {
        console.log("[CACHE HIT]");
        return sock.sendMessage(from, {
            text: cache[key]
        }, { quoted: msg });
    }

    let smartQuery = query;

    // ================= 1. DB LOKAL =================
    if (DB_LAGU[key]) {
        smartQuery = DB_LAGU[key];
        console.log("[DB MATCH]:", smartQuery);
    }

    // ================= 2. SERPER =================
    else {
        smartQuery = await searchSongSmart(query);
        console.log("[SMART RESULT]:", smartQuery);
    }

    let lyrics = null;

    // ================= TRY 1 =================
    try {
        console.log("[TRY] lyrics-finder");
        lyrics = await lyricsFinder("", smartQuery);
    } catch {}

    // ================= TRY 2 =================
    if (!lyrics) {
        console.log("[TRY] API lyrics.ovh");
        lyrics = await lyricsAPI(smartQuery);
    }

    // ================= TRY 3 =================
    if (!lyrics && smartQuery !== query) {
        console.log("[TRY] fallback original");
        lyrics = await lyricsFinder("", query);
    }

    // ================= FAIL =================
    if (!lyrics) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan

🔎 Query: ${query}

💡 Coba:
- tambahkan nama artis
- contoh: bahagia lagi piche`
        }, { quoted: msg });
    }

    lyrics = lyrics
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const result =
`🎶 LIRIK DITEMUKAN
━━━━━━━━━━━━━━
🎵 ${smartQuery}

${lyrics}`;

    // ================= SAVE CACHE =================
    cache[key] = result;
    saveCache(cache);

    // ================= SEND =================
    await sock.sendMessage(from, {
        text: result
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
