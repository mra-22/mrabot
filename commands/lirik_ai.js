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

// ================= SCORING =================
function scoreMatch(query, title, artist) {
    query = normalize(query);
    title = normalize(title);
    artist = normalize(artist);

    let score = 0;
    const words = query.split(" ");

    words.forEach(w => {
        if (title.includes(w)) score += 5;
        if (artist.includes(w)) score += 4;
    });

    // 🔥 EXACT MATCH BOOST
    if (title === query) score += 30;
    if (title.includes(query)) score += 15;

    // 🔥 SHORT QUERY BOOST (contoh: "piche")
    if (query.length <= 6 && artist.includes(query)) {
        score += 20;
    }

    // 🔥 INDO BOOST
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
        if (artist.includes(a)) score += 8;
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
            params: { q: query + " lagu indonesia lirik" }
        });

        const hits = res.data.response.hits;
        if (!hits.length) return null;

        let best = null;
        let bestScore = 0;

        for (let h of hits.slice(0, 20)) {
            const title = h.result.title;
            const artist = h.result.primary_artist.name;

            // 🔥 filter hasil aneh
            const lowTitle = title.toLowerCase();
            if (
                lowTitle.includes("translation") ||
                lowTitle.includes("live") ||
                lowTitle.includes("remix")
            ) continue;

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

// ================= FALLBACK GOOGLE =================
async function fallbackGoogle(query) {
    try {
        console.log("🔎 Fallback Google...");

        const res = await axios.get(
            `https://www.google.com/search?q=${encodeURIComponent(query + " genius lyrics")}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            }
        );

        const match = res.data.match(/https:\/\/genius\.com\/[^\"]+/);

        if (match) {
            return {
                title: query,
                artist: "Unknown",
                url: match[0]
            };
        }

        return null;

    } catch (e) {
        console.log("[GOOGLE ERROR]", e.message);
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

            html = html.replace(/<br\s*\/?>/gi, "\n");
            const text = cheerio.load(html).text();

            lyrics += text + "\n\n";
        });

        lyrics = lyrics
            .replace(/^\d+\s+Contributors.*$/im, "")
            .replace(/Translations.*$/im, "")
            .replace(/See.*Live.*$/im, "")
            .replace(/English translation[\s\S]*/i, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        // 🔥 limit WA
        if (lyrics.length > 4000) {
            lyrics = lyrics.slice(0, 4000) + "\n\n... (dipotong)";
        }

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

    // 🔥 SEARCH
    let result = await searchGeniusSmart(query);

    // 🔥 FALLBACK
    if (!result) {
        result = await fallbackGoogle(query);
    }

    if (!result) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan"
        }, { quoted: msg });
    }

    console.log("[SELECTED]:", result.artist, "-", result.title);

    // 🔥 SCRAPE
    const lyrics = await scrapeLyrics(result.url);

    if (!lyrics) {
        return sock.sendMessage(from, {
            text: "❌ Lirik gagal diambil"
        }, { quoted: msg });
    }

    // 🔥 SEND
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
    }import axios from "axios";
import * as cheerio from "cheerio";

const GENIUS_TOKEN = process.env.GENIUS_TOKEN;

// ================= NORMALIZE =================
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim();
}

// ================= SCORING =================
function scoreMatch(query, title, artist) {
    query = normalize(query);
    title = normalize(title);
    artist = normalize(artist);

    let score = 0;
    const words = query.split(" ");

    words.forEach(w => {
        if (title.includes(w)) score += 5;
        if (artist.includes(w)) score += 4;
    });

    // 🔥 EXACT MATCH BOOST
    if (title === query) score += 30;
    if (title.includes(query)) score += 15;

    // 🔥 SHORT QUERY BOOST (contoh: "piche")
    if (query.length <= 6 && artist.includes(query)) {
        score += 20;
    }

    // 🔥 INDO BOOST
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
        if (artist.includes(a)) score += 8;
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
            params: { q: query + " lagu indonesia lirik" }
        });

        const hits = res.data.response.hits;
        if (!hits.length) return null;

        let best = null;
        let bestScore = 0;

        for (let h of hits.slice(0, 20)) {
            const title = h.result.title;
            const artist = h.result.primary_artist.name;

            // 🔥 filter hasil aneh
            const lowTitle = title.toLowerCase();
            if (
                lowTitle.includes("translation") ||
                lowTitle.includes("live") ||
                lowTitle.includes("remix")
            ) continue;

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

// ================= FALLBACK GOOGLE =================
async function fallbackGoogle(query) {
    try {
        console.log("🔎 Fallback Google...");

        const res = await axios.get(
            `https://www.google.com/search?q=${encodeURIComponent(query + " genius lyrics")}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            }
        );

        const match = res.data.match(/https:\/\/genius\.com\/[^\"]+/);

        if (match) {
            return {
                title: query,
                artist: "Unknown",
                url: match[0]
            };
        }

        return null;

    } catch (e) {
        console.log("[GOOGLE ERROR]", e.message);
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

            html = html.replace(/<br\s*\/?>/gi, "\n");
            const text = cheerio.load(html).text();

            lyrics += text + "\n\n";
        });

        lyrics = lyrics
            .replace(/^\d+\s+Contributors.*$/im, "")
            .replace(/Translations.*$/im, "")
            .replace(/See.*Live.*$/im, "")
            .replace(/English translation[\s\S]*/i, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        // 🔥 limit WA
        if (lyrics.length > 4000) {
            lyrics = lyrics.slice(0, 4000) + "\n\n... (dipotong)";
        }

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

    // 🔥 SEARCH
    let result = await searchGeniusSmart(query);

    // 🔥 FALLBACK
    if (!result) {
        result = await fallbackGoogle(query);
    }

    if (!result) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan"
        }, { quoted: msg });
    }

    console.log("[SELECTED]:", result.artist, "-", result.title);

    // 🔥 SCRAPE
    const lyrics = await scrapeLyrics(result.url);

    if (!lyrics) {
        return sock.sendMessage(from, {
            text: "❌ Lirik gagal diambil"
        }, { quoted: msg });
    }

    // 🔥 SEND
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
