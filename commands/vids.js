import fs from "fs";
import axios from "axios";
import { spawn } from "child_process";
import { getSenderRawId, resolveToMainId } from '../moduls/user.js';

const adultSites = [
    "xvideos.com", "spankbang.com", "pornhub.com", "xnxx.com",
    "redtube.com", "youjizz.com", "tube8.com", "youporn.com",
    "brazzers.com", "xhamster.com", "tnaflix.com", "keezmovies.com",
    "hclips.com", "eporner.com", "extremetube.com", "drtuber.com",
    "fuq.com", "motherless.com", "pornhd.com"
];

export async function vidsCommand({ sock, msg, from, text }) {
    if (msg.key.remoteJid.endsWith('@g.us')) {
        return sock.sendMessage(from, {
            text: `❌ Perintah ini hanya bisa digunakan di *chat pribadi* untuk alasan keamanan.`,
        }, { quoted: msg });
    }

    await sock.sendMessage(from, {
        react: { text: '🔞', key: msg.key }
    });

    // === CEK LIMIT USER ===
    const userDB = JSON.parse(fs.readFileSync('./database/user.json', 'utf-8'));
    const rawId = getSenderRawId(msg); // bisa `msg.key.participant || msg.key.remoteJid`
    const userKey = resolveToMainId(rawId);
    const user = userDB?.[String(userKey)] ?? null;
    if (!user) {
        return sock.sendMessage(from, {
            text: `
╭──🔞 *BOKEP* ──⬣
│ 🚫 Kamu belum terdaftar.
│ ✅ Gunakan *!daftar* untuk mendaftar!
╰⬣`.trim()
        }, { quoted: msg });
    }

    // Inisialisasi nilai default jika belum ada
    if (typeof user.Vidlimit !== 'number') user.Vidlimit = 0;

    if (user.Vidlimit <= 0) {
        return sock.sendMessage(from, {
            text: `
╭──🔞 *BOKEP* ──⬣
│ 🚫 Limit unduhan Bokep kamu habis.
│ 🎁 Gunakan *!lmclaim* untuk klaim limit harian.
╰⬣`.trim()
        }, { quoted: msg });
    }
    const query = text.replace('!vids', '').trim();
    if (!query) {
        return sock.sendMessage(from, {
            text: `
╭──🔞 *FORMAT VIDEO DEWASA* ─⬣
│ Masukkan kata kunci atau link langsung.
│ Contoh:
│ • !vids jepang mandi
│ • !vids https://www.xvideos.com/...
╰⬣`.trim()
        }, { quoted: msg });
    }

    let videoUrl = "";
    const isDirectLink = query.startsWith("http") && adultSites.some(site => query.includes(site));

    try {
        if (isDirectLink) {
            videoUrl = query;
        } else {
            const randomSite = adultSites[Math.floor(Math.random() * adultSites.length)];
            const searchQuery = `site:${randomSite} ${query}`;

            const searchRes = await axios.post('https://google.serper.dev/videos', {
                q: searchQuery
            }, {
                headers: {
                    'X-API-KEY': process.env.SERPER_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            const maxDurasi = 300; // 5 menit
            const filtered = (searchRes.data.videos || []).filter(v => {
                if (!v.duration) return true;
                const parts = v.duration.split(':').map(Number);
                const detik = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
                return detik <= maxDurasi;
            });

            videoUrl = filtered?.[0]?.link || null;
        }

        if (!videoUrl) {
            return sock.sendMessage(from, {
                text: `
╭─❌ *VIDEO TIDAK DITEMUKAN* ─⬣
│ 🔍 Tidak ada hasil untuk *${query}*
╰⬣`.trim()
            }, { quoted: msg });
        }

        await sock.sendMessage(from, {
            text: `⚠️ *Konten Dewasa (18+)*\nSedang mengambil video dari:\n${videoUrl}`,
        }, { quoted: msg });

        const { stdout, stderr } = await runPython("moduls/downloader_playwrght.py", [videoUrl]);
        const combinedOutput = `${stdout}\n${stderr}`;
        const match = combinedOutput.match(/\[VIDDONE\](.*?\.mp4)/);
        const filePath = match ? match[1].replace(/\\\\/g, '\\').trim() : null;

        if (!filePath || !fs.existsSync(filePath)) {
            return sock.sendMessage(from, {
                text: `
╭─❌ *GAGAL UNDUH VIDEO* ─⬣
│ 🚫 Tidak dapat mengunduh atau menemukan file video.
╰⬣`.trim()
            }, { quoted: msg });
        }

        await sock.sendMessage(from, {
            video: { url: filePath },
            caption: `╭──🎥 *Video Dewasa:* ─⬣\n│ ${query}\n│🌐 ${videoUrl}\n╰⬣`
        }, { quoted: msg });

        // Kurangi limit
        user.Vidlimit -= 1;
        userDB[userKey] = user;
        // pastikan update objek user di userDB
        fs.writeFileSync('./database/user.json', JSON.stringify(userDB, null, 2));

        await sock.sendMessage(from, {
            react: { text: '✅', key: msg.key }
        });
        fs.unlinkSync(filePath);

    } catch (err) {
        console.error("❌ Error di !vids:", err);
        return sock.sendMessage(from, {
            text: `
╭─❌ *KESALAHAN* ─⬣
│ 🚫 Terjadi error saat proses pencarian atau download.
│ 💡 ${err.message}
╰⬣`.trim()
        }, { quoted: msg });
    }
}

function runPython(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === "win32";
        const py = spawn("python", [scriptPath, ...args], {
            windowsHide: true,
            shell: isWindows // ⚠️ Penting agar tidak error di Windows
        });

        let stdout = "";
        let stderr = "";

        py.stdout.on("data", (data) => { stdout += data.toString(); });
        py.stderr.on("data", (data) => { stderr += data.toString(); });

        py.on("close", () => { resolve({ stdout, stderr }); });
        py.on("error", (err) => { reject(err); });
    });
}
