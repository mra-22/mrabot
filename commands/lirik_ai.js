import fs from "fs";
import axios from "axios";
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
        .replace(/\s+/g, " ")
        .trim();
}

// ================= AI DETECT ARTIST & TITLE =================
function detectArtistTitle(raw, userQuery) {
    raw = cleanTitle(raw);

    const parts = raw.split("-").map(s => s.trim());

    let artist = "";
    let title = "";

    if (parts.length >= 2) {
        const left = parts[0];
        const right = parts[1];

        // 🔥 AI RULE:
        // kalau kanan lebih panjang → biasanya artist
        if (right.length > left.length) {
            artist = right;
            title = left;
        } else {
            artist = left;
            title = right;
        }
    } else {
        // fallback pakai query user
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

// ================= SERPER =================
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
            const title = r.title;

            if (
                title.toLowerCase().includes("lyrics") ||
                title.toLowerCase().includes("lirik") ||
                title.includes("-")
            ) {
                console.log("[SERPER RAW]:", title);

                const detected = detectArtistTitle(title, query);

                console.log("[AI DETECT]:", detected);

                return detected;
            }
        }

        return { full: query, artist: "", title: query };
    } catch (e) {
        console.log("[SERPER ERROR]", e.message);
        return { full: query, artist: "", title: query };
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

// ================= MAIN =================
export async function lirik(sock, msg, from, sender, cmd, args) {

    const query = args.join(" ").trim();

    if (!query) {
        return sock.sendMessage(from, {
            text: "Contoh: !lirik ijuk iyeth bustami"
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

    // ================= AI SEARCH =================
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

    // ================= FAIL =================
    if (!lyrics) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan

🔎 Query: ${query}

💡 Coba:
- tambahkan artis
- contoh: ijuk iyeth bustami`
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
