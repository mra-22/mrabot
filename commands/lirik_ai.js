import { chromium } from "playwright";

async function musixmatchSearch(query) {
    let browser;

    try {
        browser = await chromium.launch({
            headless: true, // bisa false kalau mau debug
        });

        const page = await browser.newPage();

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
        );

        console.log("[PW] OPEN SEARCH:", query);

        await page.goto(
            `https://www.musixmatch.com/search/${encodeURIComponent(query)}`,
            { waitUntil: "domcontentloaded", timeout: 60000 }
        );

        // ambil link lagu
        const songLink = await page.evaluate(() => {
            const el =
                document.querySelector("a[href*='/lyrics/']") ||
                document.querySelector("a.title") ||
                document.querySelector("a");

            return el ? el.href : null;
        });

        if (!songLink) {
            console.log("[PW] NO SONG LINK");
            return null;
        }

        console.log("[PW] SONG:", songLink);

        await page.goto(songLink, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        // ambil lyrics
        const lyrics = await page.evaluate(() => {
            let text = "";

            document.querySelectorAll("span").forEach(el => {
                const t = el.innerText;
                if (t && t.length > 1) {
                    text += t + "\n";
                }
            });

            return text.trim();
        });

        await browser.close();

        return lyrics || null;

    } catch (e) {
        console.log("[PW ERROR]", e.message);

        if (browser) await browser.close();

        return null;
    }
}
