import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

// ================= NORMALIZE =================
function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

// ================= CLEANER =================
function cleanText(text) {
    return text
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/window\..*?\n/g, "")
        .replace(/document\..*?\n/g, "")
        .replace(/Advertisement|Embed|Share|Copy|Lyrics|Cookie|Privacy/gi, "")
        .replace(/©.*|All rights reserved.*/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// ================= STRUCTURE DETECTOR (FIXED) =================
function detectStructure(lines) {
    const result = [];
    let buffer = [];

    const flush = () => {
        if (buffer.length) {
            result.push(buffer.join("\n"));
            buffer = [];
        }
    };

    for (const line of lines) {
        const l = line.toLowerCase();

        if (l.includes("verse")) {
            flush();
            result.push("🎤 VERSE");
            continue;
        }

        if (l.includes("chorus") || l.includes("refrain")) {
            flush();
            result.push("🎶 CHORUS");
            continue;
        }

        if (l.includes("bridge")) {
            flush();
            result.push("🎼 BRIDGE");
            continue;
        }

        // ❌ FIX: jangan buang baris pendek (ini bikin lirik hilang)
        if (l.includes("http") || l.includes("cookie") || l.includes("privacy")) continue;

        buffer.push(line);
    }

    flush();
    return result;
}

// ================= FORMAT WA (FIXED CLEAN) =================
function formatWhatsAppAI(title, lyrics, url) {
    const lines = lyrics
        .split("\n")
        .map(l => l.trim())
        .filter(l => l !== ""); // ❗ FIX PENTING

    const structured = detectStructure(lines);

    let output =
`🎶 *LIRIK DITEMUKAN*
━━━━━━━━━━━━━━
🎵 ${title}

`;

    for (const block of structured) {
        if (
            block.includes("VERSE") ||
            block.includes("CHORUS") ||
            block.includes("BRIDGE")
        ) {
            output += `\n${block}\n`;
        } else {
            output += `${block}\n\n`;
        }
    }

    output +=
`\n━━━━━━━━━━━━━━
🔗 ${url}`;

    return output;
}

// ================= SCRAPER (FIX TOTAL STABIL) =================
async function scrapeLyricsAI(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);

        let text = "";

        // ================= GENIUS =================
        if (url.includes("genius.com")) {
            $('[data-lyrics-container="true"]').each((_, el) => {
                text += $(el).text() + "\n";
            });
        }

        // ================= KAPANLAGI =================
        else if (url.includes("kapanlagi")) {
            text =
                $("#lirik-main-content").text() ||
                $(".lyrics-body").text() ||
                $(".lirik-content").text();
        }

        // ================= AZLYRICS =================
        else if (url.includes("azlyrics")) {
            const body = $("body").text();
            text = body.split("if(typeof")[0];
        }

        // ================= CLEAN =================
        text = cleanText(text);

        // ================= FALLBACK (IMPORTANT FIX) =================
        if (!text || text.length < 80) {
            const bodyText = $("body").text();

            text = bodyText
                .replace(/Advertisement|Cookie|Privacy|Login|Subscribe/gi, "")
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.length > 0) // ❗ FIX: jangan filter panjang
                .join("\n");
        }

        if (!text || text.length < 80) return null;

        return text;

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}

// ================= SEARCH (FIXED PRIORITY) =================
async function searchGoogle(query) {
    try {
        const sites = [
            "genius.com",
            "kapanlagi.com",
            "azlyrics.com"
        ];

        let all = [];

        for (const site of sites) {
            const { data } = await axios.post(
                "https://google.serper.dev/search",
                {
                    q: `${query} lirik site:${site}`
                },
                {
                    headers: {
                        "X-API-KEY": process.env.SERPER_API_KEY,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (data.organic?.length) {
                all.push(...data.organic);
            }
        }

        const filtered = all.filter(r => {
            const l = (r.link || "").toLowerCase();
            return (
                l.includes("genius.com") ||
                l.includes("kapanlagi.com") ||
                l.includes("azlyrics.com")
            );
        });

        return filtered[0]?.link || all[0]?.link || null;

    } catch (e) {
        console.log("[SEARCH ERROR]", e.message);
        return null;
    }
}

// ================= CACHE =================
const CACHE_FILE = "./database/lirik_cache.json";

function loadCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(CACHE_FILE));
    } catch {
        return {};
    }
}

function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch {}
}

// ================= MAIN BOT =================
export async function lirik(sock, msg, from, sender, cmd, args) {

    const query = args.join(" ").trim();

    if (!query) {
        return sock.sendMessage(from, {
            text: "Contoh: !lirik bahagia lagi"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    const cache = loadCache();
    const key = normalize(query);

    // ================= CACHE =================
    if (cache[key]) {
        return sock.sendMessage(from, {
            text: cache[key]
        }, { quoted: msg });
    }

    // ================= SEARCH =================
    const url = await searchGoogle(query);

    if (!url) {
        return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan"
        }, { quoted: msg });
    }

    // ================= SCRAPE =================
    const rawLyrics = await scrapeLyricsAI(url);

    if (!rawLyrics) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan

🔎 kemungkinan:
- struktur website berubah
- halaman tidak mengandung lirik
- atau diblokir scraper`
        }, { quoted: msg });
    }

    // ================= FORMAT =================
    const result = formatWhatsAppAI(query, rawLyrics, url);

    // ================= CACHE =================
    cache[key] = result;
    saveCache(cache);

    await sock.sendMessage(from, {
        text: result
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
