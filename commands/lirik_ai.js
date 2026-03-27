
import axios from "axios";
import * as cheerio from "cheerio";

// ================= SIMPLE CACHE =================
const cache = new Map();

// ================= NORMALIZER =================
function normalize(q) {
    return q
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|noah|mv/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// ================= FUZZY SCORE =================
function similarity(a, b) {
    if (!a || !b) return 0;

    const aWords = a.split(" ");
    const bWords = b.split(" ");

    let match = 0;

    for (let w of aWords) {
        if (bWords.includes(w)) match++;
    }

    return match / Math.max(aWords.length, bWords.length);
}

// ================= DUCKDUCKGO SCRAPER =================
async function searchLyrics(q) {
    try {
        console.log("[SEARCH] DDG:", q);

        const { data } = await axios.get(
            `https://duckduckgo.com/html/?q=${encodeURIComponent(q + " lyrics")}`,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120"
                }
            }
        );

        const $ = cheerio.load(data);

        let links = [];

        $("a.result__a").each((i, el) => {
            const href = $(el).attr("href");
            if (href && href.startsWith("http")) {
                links.push(href);
            }
        });

        if (!links.length) return null;

        // ambil link pertama saja (stabil)
        const link = links[0];

        console.log("[FOUND LINK]:", link);

        const page = await axios.get(link, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120"
            }
        });

        const $$ = cheerio.load(page.data);

        let lyrics = "";

        $$("p, div").each((i, el) => {
            const text = $$(el).text();
            if (text && text.length > 40) {
                lyrics += text + "\n";
            }
        });

        return lyrics.trim() || null;

    } catch (err) {
        console.log("[SEARCH ERROR]:", err.message);
        return null;
    }
}

// ================= LYRICS OVH =================
async function lyricsOVH(a, t) {
    try {
        const res = await axios.get(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(a || "")}/${encodeURIComponent(t)}`
        );
        return res.data?.lyrics || null;
    } catch {
        return null;
    }
}

// ================= MAIN EXPORT =================
export async function lirik(sock, msg, from, sender, cmd, args) {
    if (!Array.isArray(args)) args = [];

    const rawQuery = args.join(" ").trim();

    console.log("\n==============================");
    console.log("[LIRIK RAW]:", rawQuery);

    if (!rawQuery) {
        return sock.sendMessage(from, {
            text: "❗ Contoh:\n*!lirik noah separuh aku*"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    let success = false;

    try {
        // ================= CACHE =================
        if (cache.has(rawQuery)) {
            console.log("[CACHE HIT]");
            return sock.sendMessage(from, {
                text: cache.get(rawQuery)
            }, { quoted: msg });
        }

        let query = normalize(rawQuery);

        console.log("[NORMALIZED]:", query);

        let artist = "";
        let title = "";

        if (query.includes("-")) {
            [artist, title] = query.split("-").map(v => v.trim());
        } else {
            title = query;
        }

        console.log("[TITLE]:", title);
        console.log("[ARTIST]:", artist);

        // ================= MULTI SEARCH (AI STYLE) =================
        let candidates = [
            `${artist} ${title}`,
            `${title} ${artist}`,
            title,
            rawQuery
        ];

        let lyrics = null;

        let bestScore = 0;
        let bestLyrics = null;

        for (let q of candidates) {
            let result = await searchLyrics(q);

            if (result) {
                const score = similarity(q, title + " " + artist);

                console.log("[SCORE]:", score, "FOR:", q);

                if (score >= bestScore) {
                    bestScore = score;
                    bestLyrics = result;
                }
            }
        }

        lyrics = bestLyrics;

        // ================= FALLBACK =================
        if (!lyrics) {
            console.log("[FALLBACK] lyrics.ovh");
            lyrics = await lyricsOVH(artist, title);
        }

        // ================= FAIL =================
        if (!lyrics) {
            console.log("[FAILED] NO LYRICS");

            return sock.sendMessage(from, {
                text:
`❌ Lirik tidak ditemukan

🔎 Debug:
- Raw: ${rawQuery}
- Normal: ${query}

💡 Coba:
*!lirik separuh aku noah*`
            }, { quoted: msg });
        }

        // ================= CLEAN =================
        lyrics = lyrics
            .replace(/\r/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        const header =
`🎶 *LIRIK DITEMUKAN (AI MODE)*

🎵 ${title}
👤 ${artist}
━━━━━━━━━━━━━━━━━━\n`;

        // ================= CACHE SAVE =================
        cache.set(rawQuery, header + lyrics);

        // ================= CHUNK =================
        const max = 3800;
        let parts = [];

        for (let i = 0; i < lyrics.length; i += max) {
            parts.push(lyrics.slice(i, i + max));
        }

        for (let i = 0; i < parts.length; i++) {
            await sock.sendMessage(from, {
                text: i === 0 ? header + parts[i] : parts[i]
            }, { quoted: i === 0 ? msg : null });
        }

        success = true;

        console.log("[SUCCESS] SENT");

    } catch (err) {
        console.log("[GLOBAL ERROR]:", err);

        await sock.sendMessage(from, {
            text: "❌ Error internal (cek logs Railway)"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: success ? "🔥" : "❌", key: msg.key }
    });
}
