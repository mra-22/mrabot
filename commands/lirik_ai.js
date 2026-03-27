import fs from "fs";
import path from "path";
import lyricsFinder from "lyrics-finder";
import axios from "axios";

// ================= CACHE =================
const CACHE_FILE = "./database/lirik_cache.json";

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

// ================= SIMILARITY =================
function similarity(a, b) {
    const s1 = normalize(a);
    const s2 = normalize(b);

    if (s1 === s2) return 1;

    let matches = 0;
    for (let char of s1) {
        if (s2.includes(char)) matches++;
    }

    return matches / Math.max(s1.length, s2.length);
}

// ================= SMART DETECT =================
function smartDetect(query) {
    const q = normalize(query);

    // exact match DB
    if (DB_LAGU[q]) return DB_LAGU[q];

    // fuzzy match DB
    let best = null;
    let score = 0;

    for (const key in DB_LAGU) {
        const sim = similarity(q, key);
        if (sim > score) {
            score = sim;
            best = DB_LAGU[key];
        }
    }

    if (score > 0.5) return best;

    return query;
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

    // ================= LOAD CACHE =================
    const cache = loadCache();
    const key = normalize(query);

    if (cache[key]) {
        console.log("[CACHE HIT]");
        return sock.sendMessage(from, {
            text: cache[key]
        }, { quoted: msg });
    }

    // ================= SMART QUERY =================
    const smartQuery = smartDetect(query);

    console.log("[SMART]:", smartQuery);

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
