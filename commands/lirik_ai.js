import axios from "axios";
import * as cheerio from "cheerio";

const GENIUS_TOKEN = process.env.GENIUS_TOKEN;

// ================= SEARCH GENIUS =================
async function searchGenius(query) {
    try {
        const res = await axios.get(
            "https://api.genius.com/search",
            {
                headers: {
                    Authorization: `Bearer ${GENIUS_TOKEN}`
                },
                params: {
                    q: query
                }
            }
        );

        const hits = res.data.response.hits;

        if (!hits.length) return null;

        // ambil hasil paling relevan
        const song = hits[0].result;

        return {
            title: song.full_title,
            url: song.url
        };

    } catch (e) {
        console.log("[GENIUS SEARCH ERROR]", e.message);
        return null;
    }
}

// ================= SCRAPE LYRICS =================
async function scrapeLyrics(url) {
    try {
        const { data } = await axios.get(url);

        const $ = cheerio.load(data);

        let lyrics = "";

        // genius pakai container ini
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

    if (!query) {
        return sock.sendMessage(from, {
            text: "Contoh: !lirik bahagia lagi"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    console.log("[GENIUS SEARCH]:", query);

    // 🔍 cari lagu
    const result = await searchGenius(query);

    if (!result) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan di Genius"
        }, { quoted: msg });
    }

    console.log("[FOUND]:", result.title);

    // 📄 ambil lirik
    const lyrics = await scrapeLyrics(result.url);

    if (!lyrics) {
        return sock.sendMessage(from, {
            text: "❌ Lirik tidak ditemukan"
        }, { quoted: msg });
    }

    const text =
`🎶 *${result.title}*
━━━━━━━━━━━━━━

${lyrics}`;

    await sock.sendMessage(from, {
        text
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
