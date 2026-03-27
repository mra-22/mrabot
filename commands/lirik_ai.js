import axios from "axios";
import * as cheerio from "cheerio";

function normalize(q) {
    return q
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|mv/g, "")
        .trim();
}

// ================= MUSIXMATCH SCRAPER =================
async function musixmatchSearch(query) {
    try {
        const url = `https://www.musixmatch.com/search/${encodeURIComponent(query)}`;

        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const $ = cheerio.load(data);

        const link = $("a.title").attr("href");

        if (!link) return null;

        const songUrl = "https://www.musixmatch.com" + link;

        const page = await axios.get(songUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $$ = cheerio.load(page.data);

        let lyrics = "";

        $$("span").each((i, el) => {
            const t = $$(el).text();
            if (t.length > 2) lyrics += t + "\n";
        });

        return lyrics.trim() || null;

    } catch (e) {
        return null;
    }
}

// ================= AZLYRICS FALLBACK =================
async function azlyricsSearch(query) {
    try {
        const url = `https://search.azlyrics.com/search.php?q=${encodeURIComponent(query)}`;

        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);

        const link = $("td a").attr("href");

        if (!link) return null;

        const page = await axios.get(link, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $$ = cheerio.load(page.data);

        let lyrics = $$("div.lyricsh").next().text();

        return lyrics || null;

    } catch {
        return null;
    }
}

// ================= MAIN =================
export async function lirik(sock, msg, from, args) {
    const query = args.join(" ").trim();

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

    console.log("[NORMALIZED]:", q);

    // ================= TRY 1: MUSIXMATCH =================
    console.log("[TRY] Musixmatch");
    lyrics = await musixmatchSearch(q);

    // ================= TRY 2: AZLYRICS =================
    if (!lyrics) {
        console.log("[TRY] AZLyrics");
        lyrics = await azlyricsSearch(q);
    }

    // ================= FAIL =================
    if (!lyrics) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan

🔎 Query: ${query}

💡 Tips:
- coba: separuh aku noah
- atau: noah separuh aku`
        }, { quoted: msg });
    }

    lyrics = lyrics
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const header =
`🎶 LIRIK DITEMUKAN
━━━━━━━━━━━━━━
🎵 ${query}
`;

    await sock.sendMessage(from, {
        text: header + "\n" + lyrics
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
