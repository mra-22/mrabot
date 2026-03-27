import axios from "axios";
import * as cheerio from "cheerio";
import { loadCookie } from "../cookieParser.js";

const COOKIE = loadCookie("cookiesms.txt");

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.musixmatch.com/",
    "Cookie": COOKIE
};

// ================= NORMALIZE =================
function normalize(q) {
    return q
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|mv/g, "")
        .trim();
}

// ================= MUSIXMATCH =================
async function musixmatchSearch(query) {
    try {
        const url = `https://www.musixmatch.com/search/${encodeURIComponent(query)}`;

        const { data } = await axios.get(url, { headers });

        const $ = cheerio.load(data);

        const link =
            $("a[href*='/lyrics/']").attr("href") ||
            $("a.title").attr("href") ||
            $("a").first().attr("href");

        if (!link) return null;

        const songUrl = link.startsWith("http")
            ? link
            : "https://www.musixmatch.com" + link;

        const page = await axios.get(songUrl, { headers });

        const $$ = cheerio.load(page.data);

        let lyrics = "";

        $$("span").each((i, el) => {
            const t = $$(el).text().trim();

            if (
                t.length > 1 &&
                !t.includes("Cookies") &&
                !t.includes("Report") &&
                !t.includes("Lyrics")
            ) {
                lyrics += t + "\n";
            }
        });

        return lyrics.trim() || null;

    } catch (e) {
        console.log("[MUSIXMATCH ERROR]", e.message);
        return null;
    }
}

// ================= AZLYRICS =================
async function azlyricsSearch(query) {
    try {
        const url = `https://search.azlyrics.com/search.php?q=${encodeURIComponent(query)}`;

        const { data } = await axios.get(url, {
            headers: { "User-Agent": headers["User-Agent"] }
        });

        const $ = cheerio.load(data);

        const link = $("td a").attr("href");
        if (!link) return null;

        const page = await axios.get(link, {
            headers: { "User-Agent": headers["User-Agent"] }
        });

        const $$ = cheerio.load(page.data);

        let lyrics = $$("div.lyricsh").next().text();

        return lyrics || null;

    } catch (e) {
        console.log("[AZLYRICS ERROR]", e.message);
        return null;
    }
}

// ================= MAIN =================
export async function lirik(sock, msg, from, sender, cmd, args) {
    const query = (() => {
        if (Array.isArray(args)) return args.join(" ").trim();
        if (typeof args === "string") return args.trim();
        return "";
    })();

    console.log("[LIRIK RAW]:", query);

    if (!query || query.length < 2) {
        return sock.sendMessage(from, {
            text: "Ketik: !lirik noah separuh aku"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    const q = normalize(query);

    console.log("[NORMALIZED]:", q);
    console.log("[COOKIE STATUS]:", COOKIE ? "ADA" : "KOSONG");

    let lyrics = null;

    // ================= TRY MUSIXMATCH =================
    console.log("[TRY] Musixmatch");
    lyrics = await musixmatchSearch(q);

    // ================= TRY AZLYRICS =================
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
