import * as cheerio from "cheerio";
import { chromium } from "playwright";

function normalize(q) {
    return q
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|mv/g, "")
        .trim();
}

// ================= PLAYWRIGHT MUSIXMATCH =================
async function musixmatchSearch(query) {
    let browser;

    try {
        browser = await chromium.launch({
            headless: true,
        });

        const page = await browser.newPage();

        // 🔥 fake human headers
        await page.setExtraHTTPHeaders({
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        });

        const searchUrl = `https://www.musixmatch.com/search/${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

        const html = await page.content();
        const $ = cheerio.load(html);

        const link =
            $("a[href*='/lyrics/']").attr("href") ||
            $("a.title").attr("href") ||
            $("a").first().attr("href");

        if (!link) {
            await browser.close();
            return null;
        }

        const songUrl = link.startsWith("http")
            ? link
            : "https://www.musixmatch.com" + link;

        await page.goto(songUrl, { waitUntil: "domcontentloaded" });

        const pageHtml = await page.content();
        const $$ = cheerio.load(pageHtml);

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

        await browser.close();

        return lyrics.trim() || null;
    } catch (e) {
        if (browser) await browser.close();
        console.log("[MUSIXMATCH ERROR]", e.message);
        return null;
    }
}

// ================= AZLYRICS FALLBACK =================
async function azlyricsSearch(query) {
    try {
        const url = `https://search.azlyrics.com/search.php?q=${encodeURIComponent(query)}`;

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        const html = await res.text();
        const $ = cheerio.load(html);

        const link = $("td a").attr("href");
        if (!link) return null;

        const page = await fetch(link, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        const pageHtml = await page.text();
        const $$ = cheerio.load(pageHtml);

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

    let lyrics = null;
    const q = normalize(query);

    console.log("[NORMALIZED]:", q);

    // ================= TRY 1 =================
    console.log("[TRY] Musixmatch (Playwright)");
    lyrics = await musixmatchSearch(q);

    // ================= TRY 2 =================
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
