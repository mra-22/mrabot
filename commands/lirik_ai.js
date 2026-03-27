import axios from "axios";
import * as cheerio from "cheerio";

const GENIUS_TOKEN = process.env.GENIUS_TOKEN;

// ================= NORMALIZE =================
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim();
}

// ================= SIMILARITY =================
function scoreMatch(query, title, artist) {
    query = normalize(query);
    title = normalize(title);
    artist = normalize(artist);

    let score = 0;

    const words = query.split(" ");

    words.forEach(w => {
        if (title.includes(w)) score += 3;
        if (artist.includes(w)) score += 2;
    });

    // 🔥 bonus artis indo populer
    const indoArtists = [
        "piche kota",
        "noah",
        "hindia",
        "juicy luicy",
        "armada",
        "mahalini",
        "rizky febian"
    ];

    indoArtists.forEach(a => {
        if (artist.includes(a)) score += 2;
    });

    return score;
}

// ================= SEARCH GENIUS =================
async function searchGeniusSmart(query) {
    try {
        const res = await axios.get("https://api.genius.com/search", {
            headers: {
                Authorization: `Bearer ${GENIUS_TOKEN}`
            },
            params: { q: query }
        });

        const hits = res.data.response.hits;

        if (!hits.length) return null;

        let best = null;
        let bestScore = 0;

        for (let h of hits.slice(0, 10)) {
            const title = h.result.title;
            const artist = h.result.primary_artist.name;

            const score = scoreMatch(query, title, artist);

            console.log(`[CANDIDATE] ${artist} - ${title} | score=${score}`);

            if (score > bestScore) {
                bestScore = score;
                best = {
                    title: h.result.full_title,
                    url: h.result.url,
                    artist,
                };
            }
        }

        return best;

    } catch (e) {
        console.log("[GENIUS ERROR]", e.message);
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
            }
        });

        const $ = cheerio.load(data);

        let lyrics = "";

        $("div[data-lyrics-container='true']").each((i, el) => {
            let html = $(el).html();

            // ubah <br> jadi newline
            html = html.replace(/<br\s*\/?>/gi, "\n");

            // hapus semua tag HTML
            const text = cheerio.load(html).text();

            lyrics += text + "\n\n";
        });

        lyrics = lyrics
            .replace(/^\d+\s+Contributors.*$/im, "") // hapus contributors
            .replace(/Translations.*$/im, "") // hapus translation
            .replace(/See.*Live.*$/im, "") // hapus live info
            .replace(/\n{3,}/g, "\n\n") // rapihin newline
            .trim();

        return lyrics;

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}
// ================= MAIN =================
export async function lirik(sock, msg, from, sender, cmd, args) {

    const query = Array.isArray(args) ? args.join(" ") : args;

    console.log("[AUTO SEARCH]:", query);

    if (!query) {
        return sock.sendMessage(from, {
            text: "Contoh: !lirik bahagia lagi"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    // 🔥 AUTO DETECT ARTIST
    const result = await searchGeniusSmart(query);

    if (!result) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan"
        }, { quoted: msg });
    }

    console.log("[SELECTED]:", result.artist, "-", result.title);

    const lyrics = await scrapeLyrics(result.url);

    if (!lyrics) {
        return sock.sendMessage(from, {
            text: "❌ Lirik gagal diambil"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        text:
`🎶 ${result.title}
👤 Artist: ${result.artist}
━━━━━━━━━━━━━━

${lyrics}`
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
