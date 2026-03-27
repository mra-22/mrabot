import lyricsFinder from "lyrics-finder";
import axios from "axios";

function normalize(q) {
    return q
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|mv/g, "")
        .trim();
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

    let lyrics = null;
    const q = normalize(query);

    console.log("[TRY] lyrics-finder");
    lyrics = await lyricsFinder(q);

    // fallback API
    if (!lyrics) {
        console.log("[TRY] API fallback");
        lyrics = await apiLyrics(q);
    }

    if (!lyrics) {
        return sock.sendMessage(from, {
            text: `❌ Lirik tidak ditemukan\n\n🔎 ${query}`
        }, { quoted: msg });
    }

    lyrics = lyrics
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const text =
`🎶 LIRIK DITEMUKAN
━━━━━━━━━━━━━━
🎵 ${query}

${lyrics}`;

    await sock.sendMessage(from, { text }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
