import axios from "axios";
import lyricsFinder from "lyrics-finder";

// ================= NORMALIZE =================
function normalize(q) {
    return q
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|mv/g, "")
        .trim();
}

// ================= SMART SEARCH =================
async function smartSearch(query) {
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=5`;
        const { data } = await axios.get(url);

        if (!data.results || data.results.length === 0) return null;

        // ambil hasil paling atas
        const best = data.results[0];

        const title = best.trackName;
        const artist = best.artistName;

        console.log("[SMART RESULT]:", title, "-", artist);

        return `${artist} ${title}`;
    } catch (e) {
        console.log("[SMART SEARCH ERROR]", e.message);
        return null;
    }
}

// ================= FALLBACK API =================
async function apiLyrics(query) {
    try {
        const res = await axios.get(`https://api.popcat.xyz/lyrics?song=${encodeURIComponent(query)}`);
        return res.data?.lyrics || null;
    } catch {
        return null;
    }
}

// ================= FIND SMART =================
async function findLyricsSmart(query) {
    const tries = [];

    // 1. original
    tries.push(query);

    // 2. smart suggestion
    const smart = await smartSearch(query);
    if (smart) tries.push(smart);

    // 3. variasi tambahan
    tries.push(query + " lyrics");
    tries.push(query + " lirik");
    tries.push(query.split(" ").reverse().join(" "));

    for (let q of tries) {
        console.log("[TRY QUERY]:", q);

        let res = await lyricsFinder(q);
        if (res) return { lyrics: res, used: q };

        const api = await apiLyrics(q);
        if (api) return { lyrics: api, used: q };
    }

    return null;
}

// ================= MAIN =================
export async function lirik(sock, msg, from, sender, cmd, args) {

    const query = Array.isArray(args) ? args.join(" ").trim() : "";

    console.log("[LIRIK RAW]:", query);

    if (!query) {
        return sock.sendMessage(from, {
            text: "Ketik: !lirik noah separuh aku"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    const q = normalize(query);

    const result = await findLyricsSmart(q);

    if (!result) {
        return sock.sendMessage(from, {
            text: `❌ Lirik tidak ditemukan\n\n🔎 ${query}`
        }, { quoted: msg });
    }

    const lyrics = result.lyrics
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const text =
`🎶 LIRIK DITEMUKAN
━━━━━━━━━━━━━━
🔎 Query: ${query}
🎯 Dipakai: ${result.used}

${lyrics}`;

    await sock.sendMessage(from, { text }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
