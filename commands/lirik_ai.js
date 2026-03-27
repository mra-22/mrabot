import lyricsFinder from "lyrics-finder";

// ================= NORMALIZE =================
function normalize(q) {
    return q
        .toLowerCase()
        .replace(/official|lyrics|lirik|video|audio|mv/g, "")
        .trim();
}

// ================= VALIDASI HASIL =================
function isValidLyrics(lyrics, query) {
    if (!lyrics) return false;

    const qWords = query.toLowerCase().split(" ").filter(w => w.length > 3);

    // minimal 1 kata dari query harus ada di lirik
    return qWords.some(word => lyrics.toLowerCase().includes(word));
}

// ================= SMART QUERY =================
function generateQueries(query) {
    const q = query.toLowerCase();

    const guesses = [
        q,
        q + " lyrics",
        q + " lirik",
    ];

    // 🔥 kalau cuma 2 kata → coba bolak balik
    const parts = q.split(" ");
    if (parts.length === 2) {
        guesses.push(`${parts[1]} ${parts[0]}`);
    }

    // 🔥 guess artist Indonesia populer
    const artistHints = [
        "piche kota",
        "noah",
        "hindia",
        "juicy luicy",
        "armada",
        "mahalini",
        "rizky febian",
    ];

    artistHints.forEach(artist => {
        guesses.push(`${query} ${artist}`);
    });

    return [...new Set(guesses)];
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
            text: "Ketik: !lirik bahagia lagi"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key }
    });

    const q = normalize(query);
    const queries = generateQueries(q);

    console.log("[SMART QUERIES]:", queries);

    let lyrics = null;
    let usedQuery = "";

    // ================= LOOP PENCARIAN =================
    for (let qTry of queries) {
        console.log("[TRY QUERY]:", qTry);

        try {
            const res = await lyricsFinder(qTry, "");

            if (isValidLyrics(res, q)) {
                lyrics = res;
                usedQuery = qTry;
                console.log("[VALID ✔]:", qTry);
                break;
            } else {
                console.log("[INVALID ❌]:", qTry);
            }

        } catch (e) {
            console.log("[ERROR]:", e.message);
        }
    }

    // ================= FAIL =================
    if (!lyrics) {
        return sock.sendMessage(from, {
            text:
`❌ Lirik tidak ditemukan (sudah dicoba pintar)

🔎 Query: ${query}

💡 Tips:
- tambah nama penyanyi
- contoh: !lirik bahagia lagi piche`
        }, { quoted: msg });
    }

    lyrics = lyrics
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const header =
`🎶 LIRIK DITEMUKAN
━━━━━━━━━━━━━━
🔎 Query Asli : ${query}
✅ Dipakai    : ${usedQuery}
`;

    await sock.sendMessage(from, {
        text: header + "\n" + lyrics
    }, { quoted: msg });

    await sock.sendMessage(from, {
        react: { text: "🔥", key: msg.key }
    });
}
