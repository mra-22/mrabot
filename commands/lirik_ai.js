import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

// ================= NORMALIZE =================
function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

// ================= AI CLEANER =================
function aiCleanLyrics(raw) {
    return raw
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/window\..*?\n/g, "")
        .replace(/document\..*?\n/g, "")
        .replace(/\{[\s\S]*?\}/g, "")
        .replace(/Advertisement|Embed|Share|Copy|Lyrics|Cookie|Privacy/gi, "")
        .replace(/©.*|All rights reserved.*/gi, "")
        .replace(/\s{3,}/g, "\n")
        .trim();
}

// ================= STRUCTURE DETECTOR =================
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

        if (
            l.includes("http") ||
            l.includes("cookie") ||
            l.includes("privacy") ||
            l.length < 2
        ) continue;

        buffer.push(line);
    }

    flush();
    return result;
}

// ================= FORMAT WA =================
function formatWhatsAppAI(title, lyrics, url) {
    const lines = lyrics
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    const structured = detectStructure(lines);

    let output =
`🎶 *LIRIK DITEMUKAN*
━━━━━━━━━━━━━━
🎵 ${title}
\n`;

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

// ================= SCRAPER =================
async function scrapeLyricsAI(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const $ = cheerio.load(data);
        let text = "";

        // ================= GENIUS (BEST SOURCE) =================
        if (url.includes("genius.com")) {
            $('[data-lyrics-container="true"]').each((i, el) => {
                text += $(el).text() + "\n";
            });
        }

        // ================= KAPANLAGI (FIXED TOTAL) =================
        else if (url.includes("kapanlagi")) {

            // 🔥 INI FIX UTAMA: ambil hanya container lirik
            text = $("#lirik-main-content").text()
                || $(".lyrics-body").text()
                || $(".lirik-content").text();

        }

        // ================= AZLYRICS (FIXED CLEAN) =================
        else if (url.includes("azlyrics")) {

            // ambil hanya middle content (bukan semua div)
            const bodyText = $("body").text();

            // potong noise kasar
            text = bodyText.split("if(typeof")[0]; // buang JS KapanLagi style
        }

        // ================= FINAL CLEAN =================
        text = text
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/if\s*\(typeof[\s\S]*$/gim, "")   // 🔥 FIX ERROR KAMU
            .replace(/#tipsmodal[\s\S]*/gi, "")
            .replace(/\.lyric-top-search[\s\S]*/gi, "")
            .replace(/window\..*?\n/g, "")
            .replace(/document\..*?\n/g, "")
            .replace(/Advertisement|Embed|Share|Copy|Cookie|Privacy/gi, "")
            .replace(/\s{3,}/g, "\n")
            .trim();

        if (text.length < 80) return null;

        return text;

    } catch (e) {
        console.log("[SCRAPE ERROR]", e.message);
        return null;
    }
}
// ================= SEARCH =================
async function searchGoogle(query) {
    try {
        const sites = [
            "kapanlagi.com",
            "genius.com",
            "azlyrics.com"
        ];

        const resultsAll = [];

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
                resultsAll.push(...data.organic);
            }
        }

        for (const r of resultsAll) {
            const link = r.link;

            if (
                link.includes("kapanlagi") ||
                link.includes("genius") ||
                link.includes("azlyrics")
            ) {
                return link;
            }
        }

        return resultsAll[0]?.link || null;

    } catch (e) {
        console.log("[SEARCH ERROR]", e.message);
        return null;
    }
}

// ================= CACHE =================
const CACHE_FILE = "./database/lirik_cache.json";

function loadCache() {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE));
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
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
            text: "❌ Lirik tidak ditemukan / tidak bisa diambil"
        }, { quoted: msg });
    }

    // ================= FORMAT =================
    const result = formatWhatsAppAI(query, rawLyrics, url);

    // ================= CACHE SAVE =================
    cache[key] = result;
    saveCache(cache);

    await sock.sendMessage(from, {
        text: result
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
