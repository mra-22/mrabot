import axios from "axios";
import * as cheerio from "cheerio";

const GENIUS_TOKEN = process.env.GENIUS_TOKEN;

// ================= SIMILARITY =================
function similarity(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();

    let score = 0;
    const words = a.split(" ");

    words.forEach(w => {
        if (b.includes(w)) score++;
    });

    return score;
}

// ================= SEARCH GENIUS =================
async function searchGenius(query) {
    try {
        const res = await axios.get("https://api.genius.com/search", {
            headers: {
                Authorization: `Bearer ${GENIUS_TOKEN}`
            },
            params: { q: query }
        });

        const hits = res.data.response.hits;

        if (!hits.length) return null;

        // 🔥 pilih yang paling mirip
        let best = null;
        let bestScore = 0;

        for (let h of hits) {
            const title = h.result.full_title;
            const score = similarity(query, title);

            if (score > bestScore) {
                bestScore = score;
                best = h.result;
            }
        }

        // minimal harus cocok
        if (!best || bestScore === 0) return null;

        return {
            title: best.full_title,
            url: best.url
        };

    } catch (e) {
        console.log("[GENIUS SEARCH ERROR]", e.message);
        return null;
    }
}

// ================= SCRAPE =================
async function scrapeLyrics(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://genius.com/",
            }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        $("div[data-lyrics-container='true']").each((i, el) => {
            lyrics += $(el).text() + "\n";
        });

        return lyrics.trim();

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}

// ================= MAIN =================
export async function lirik(sock, msg, from, sender, cmd, args) {

    const query = Array.isArray(args) ? args.join(" ") : args;

    console.log("[GENIUS SEARCH]:", query);

    if (!query) {
        return sock.sendMessage(from, {
            text: "Contoh: !lirik bahagia lagi"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    const result = await searchGenius(query);

    if (!result) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan (filter aktif)"
        }, { quoted: msg });
    }

    console.log("[FOUND]:", result.title);

    const lyrics = await scrapeLyrics(result.url);

    if (!lyrics) {
        return sock.sendMessage(from, {
            text: "❌ Lirik gagal diambil (Genius block)"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        text:
`🎶 ${result.title}
━━━━━━━━━━━━━━

${lyrics}`
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
