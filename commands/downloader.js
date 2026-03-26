import { exec } from "child_process";
import path from "path";
import fs from "fs";
import util from "util";
import { getSenderRawId, resolveToMainId } from "../moduls/user.js";

const execPromise = util.promisify(exec);
const pythonCmd = process.platform === "win32" ? "py" : "python3";
const DOWNLOAD_DIR = path.resolve("./videos");
const downloadingUsers = new Set();

/* ===================== HELPERS ===================== */

// hapus emoji & simbol aneh
function sanitizeFileName(name) {
    return name
        .replace(/[\p{Extended_Pictographic}\p{Emoji}\u200d]+/gu, "")
        .replace(/[^a-zA-Z0-9\s._-]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function formatDuration(sec = 0) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}
// ambil file media TERBARU dari folder download
async function getLatestMediaFileSafe(dir, retry = 10, delay = 500) {
    for (let attempt = 0; attempt < retry; attempt++) {
        try {
            const files = fs.readdirSync(dir)
                .filter(f => /\.(mp4|jpg|jpeg|png)$/i.test(f))
                .map(f => {
                    try {
                        const full = path.join(dir, f);
                        const stat = fs.statSync(full);
                        return { file: full, time: stat.mtimeMs };
                    } catch {
                        return null; // file belum siap / hilang
                    }
                })
                .filter(Boolean)
                .sort((a, b) => b.time - a.time);

            if (files.length) return files[0].file;
        } catch { }

        // tunggu file selesai ditulis
        await new Promise(r => setTimeout(r, delay));
    }

    return null;
}


/* ===================== COMMAND ===================== */

export async function downloaderCommand({ sock, msg, from, text }) {
    const url = text.trim().split(/\s+/)[1];

    if (!url) {
        return sock.sendMessage(from, {
            text: `╭──📥 DOWNLOADER ──⬣
│❗ Masukkan URL yang valid.
│📌 Contoh: *.media https://vt.tiktok.com/...*
╰⬣`,
        }, { quoted: msg });
    }

    const rawId = getSenderRawId(msg);
    const userId = resolveToMainId(rawId);

    const users = JSON.parse(fs.readFileSync("./database/user.json"));
    const user = users[userId];

    if (!user) {
        return sock.sendMessage(from, {
            text: `╭──📥 DOWNLOADER ──⬣
│🚫 Kamu belum terdaftar.
│✅ Gunakan *!daftar*
╰⬣`,
        }, { quoted: msg });
    }

    if (typeof user.Vidlimit !== "number") user.Vidlimit = 0;
    if (user.Vidlimit <= 0) {
        return sock.sendMessage(from, {
            text: `╭──📥 DOWNLOADER ──⬣
│🚫 Limit video kamu habis.
│🎁 Klaim harian: *!lmclaim*
╰⬣`,
        }, { quoted: msg });
    }

    if (downloadingUsers.has(userId)) {
        return sock.sendMessage(from, {
            text: `╭──📥 DOWNLOADER ──⬣
│⏳ Kamu masih mengunduh media.
╰⬣`,
        }, { quoted: msg });
    }

    downloadingUsers.add(userId);
    await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

    try {
        const pythonPath = path.resolve("./moduls/downloader.py");
        const { stdout, stderr } = await execPromise(
            `${pythonCmd} "${pythonPath}" "${url}"`
        );

        if (stderr) console.error("PYTHON STDERR:", stderr);

        // ==============================
        // 🔥 PARSE MULTI FILE (SLIDESHOW)
        // ==============================
        let files = [];
        stdout.split(/\r?\n/).forEach(line => {
            if (line.startsWith("::FILES::")) {
                try {
                    files = JSON.parse(line.replace("::FILES::", ""));
                } catch { }
            }
        });

        // ==============================
        // 🔥 PARSE SINGLE FILE FALLBACK
        // ==============================
        let singleFile = null;
        const fileLine = stdout.split(/\r?\n/).find(l => l.startsWith("::FILE::"));
        if (fileLine) {
            singleFile = fileLine.replace("::FILE::", "").trim();
        }

        // ==============================
        // 🔥 CAPTION
        // ==============================
        let caption = `╭━━━〔 📥 DOWNLOADER 〕━━━⬣`;

        const infoLine = stdout.split(/\r?\n/).find(l => l.startsWith("::INFO::"));
        if (infoLine) {
            try {
                const info = JSON.parse(infoLine.replace("::INFO::", ""));
                caption += `
┃ 🎞️ Judul   : ${sanitizeFileName(info.title || "-")}
┃ 📤 Channel : ${sanitizeFileName(info.uploader || "-")}
┃ 👁️ Views   : ${info.view_count || 0}
╰━━━━━━━━━━━━━━━━⬣`;
            } catch {
                caption += `\n╰━━━━━━━━━━━━━━━━⬣`;
            }
        } else {
            caption += `\n╰━━━━━━━━━━━━━━━━⬣`;
        }

        await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        // ==============================
        // 🔥 KIRIM MULTI FILE (ALBUM)
        // ==============================
        if (files.length > 0) {

            for (let i = 0; i < files.length; i++) {
                const filePath = files[i];

                if (i === 0) {
                    // ✅ hanya pertama pakai caption + reply
                    await sock.sendMessage(from, {
                        image: { url: filePath },
                        caption: caption
                    }, { quoted: msg });
                } else {
                    // ✅ sisanya TANPA caption & TANPA reply
                    await sock.sendMessage(from, {
                        image: { url: filePath }
                    });
                }

                // delay biar rapi (optional)
                await new Promise(r => setTimeout(r, 150));

                // 🔥 auto delete
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

        }
        // ==============================
        // 🔥 SINGLE FILE (VIDEO / IMAGE)
        // ==============================
        else if (singleFile) {

            const ext = path.extname(singleFile).toLowerCase();
            const isVideo = ext === ".mp4";

            await sock.sendMessage(from, {
                [isVideo ? "video" : "image"]: fs.readFileSync(singleFile),
                caption,
                mimetype: isVideo ? "video/mp4" : "image/jpeg",
            }, { quoted: msg });

            // 🔥 AUTO DELETE
            if (fs.existsSync(singleFile)) {
                fs.unlinkSync(singleFile);
            }

        } else {
            throw new Error("Tidak ada file ditemukan dari Python");
        }

        // ==============================
        // 🔥 KURANGI LIMIT
        // ==============================
        user.Vidlimit -= 1;
        users[userId] = user;
        fs.writeFileSync("./database/user.json", JSON.stringify(users, null, 2));

    } catch (err) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
        await sock.sendMessage(from, {
            text: `❌ Gagal mengunduh media.\nError: ${err.message}`,
        }, { quoted: msg });
    } finally {
        downloadingUsers.delete(userId);
    }
}


/* ============================================================
   ===============         PLAY MUSIC        ==================
   ============================================================*/
export async function play(sock, msg, from, sender, cmd, args) {
    if (!Array.isArray(args)) args = [];
    const query = args.join(" ");

    if (!query) {
        return sock.sendMessage(from, {
            text: `╭──📥 DOWNLOADER ──⬣
│❗ Masukkan judul lagu.
│📌 Contoh: *.play alan walker faded*
╰⬣`,
        }, { quoted: msg });
    }

    const userDB = JSON.parse(fs.readFileSync("./database/user.json", "utf-8"));
    const rawId = getSenderRawId(msg);
    const userKey = resolveToMainId(rawId);
    const user = userDB?.[String(userKey)] ?? null;

    if (!user) {
        return sock.sendMessage(from, {
            text: `╭──🎵 PLAY ──⬣
│🚫 Kamu belum terdaftar.
│✅ Gunakan *!daftar*
╰⬣`,
        }, { quoted: msg });
    }

    if (typeof user.Vidlimit !== "number") user.Vidlimit = 0;

    if (user.Vidlimit <= 0) {
        return sock.sendMessage(from, {
            text: `╭──🎵 PLAY ──⬣
│🚫 Limit habis
│🎁 *!lmclaim*
╰⬣`,
        }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
    await sock.sendMessage(from, {
        text: `🔍 Mencari *${query}*...`
    }, { quoted: msg });

    let success = false;
    let videoUrl = null;

    // ======================
    // 🔥 1. TRY PYTHON (yt-dlp)
    // ======================
    try {
        const { stdout, stderr } = await execPromise(
            `python3 ./moduls/downloader_lagu.py "${query}"`
        );

        if (stderr) console.log(stderr);
        console.log("STDOUT:", stdout);

        const mp3Match = stdout.match(/::SUCCESS::(.+)/);
        const titleMatch = stdout.match(/::TITLE::(.+)/);
        const urlMatch = stdout.match(/::URL::(.+)/);

        videoUrl = urlMatch ? urlMatch[1].trim() : null;

        if (mp3Match) {
            const mp3Path = mp3Match[1].trim();
            const title = titleMatch ? titleMatch[1].trim() : query;

            if (!fs.existsSync(mp3Path)) {
                throw new Error("File MP3 tidak ditemukan");
            }

            const buffer = fs.readFileSync(mp3Path);

            await sock.sendMessage(from, {
                audio: buffer,
                mimetype: "audio/mpeg",
                fileName: `${title}.mp3`
            }, { quoted: msg });

            fs.unlinkSync(mp3Path);
            success = true;
        }

    } catch (e) {
        console.log("❌ yt-dlp gagal → fallback");
    }

    // ======================
    // 🔥 2. AUTO SEARCH URL (kalau null)
    // ======================
    if (!videoUrl) {
        try {
            const res = await fetch(
                `https://ytsearch.vercel.app/api?query=${encodeURIComponent(query)}`
            );
            const data = await res.json();

            if (data.result && data.result.length > 0) {
                videoUrl = data.result[0].url;
                console.log("✅ URL dari search:", videoUrl);
            }
        } catch (e) {
            console.log("❌ gagal ambil URL dari search API");
        }
    }

    // ======================
    // 🔥 3. FALLBACK API 1
    // ======================
    if (!success && videoUrl) {
        try {
            const res = await fetch(
                `https://api.vevioz.com/api/button/mp3/${encodeURIComponent(videoUrl)}`
            );

            const html = await res.text();

            await sock.sendMessage(from, {
                text: `⚠️ yt-dlp gagal.\nDownload di sini:\n${html}`
            }, { quoted: msg });

            success = true;

        } catch (e) {
            console.log("❌ fallback 1 gagal");
        }
    }

    // ======================
    // 🔥 4. FALLBACK API 2
    // ======================
    if (!success && videoUrl) {
        try {
            const res = await fetch(
                `https://ytdl-api.caliphdev.com/download/audio?url=${encodeURIComponent(videoUrl)}`
            );

            const json = await res.json();

            if (json.result?.download_url) {
                await sock.sendMessage(from, {
                    audio: { url: json.result.download_url },
                    mimetype: "audio/mpeg"
                }, { quoted: msg });

                success = true;
            }

        } catch (e) {
            console.log("❌ fallback 2 gagal");
        }
    }

    // ======================
    // 🔥 5. LAST FALLBACK (kirim URL)
    // ======================
    if (!success && videoUrl) {
        await sock.sendMessage(from, {
            text: `🎧 Tidak bisa kirim audio.\nGunakan link ini:\n${videoUrl}`
        }, { quoted: msg });

        success = true;
    }

    // ======================
    // ❌ FINAL FAIL
    // ======================
    if (!success) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });

        return sock.sendMessage(from, {
            text: "❌ Semua metode gagal. Coba lagi nanti."
        }, { quoted: msg });
    }

    // ======================
    // ✅ SUCCESS
    // ======================
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

    user.Vidlimit -= 1;
    userDB[userKey] = user;
    fs.writeFileSync("./database/user.json", JSON.stringify(userDB, null, 2));
}
/* ============================================================
   ==================  DOWNLOAD APK  ==========================
   ============================================================*/
export async function Apk(sock, msg, from, sender, cmd, args) {
    if (msg.key.fromMe) return;

    const appName = args.join(" ");
    if (!appName) {
        return sock.sendMessage(from, {
            text: "❌ Contoh: !downloadapk WhatsApp"
        }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

    try {
        const { stdout, stderr } = await execPromise(
            `python ./moduls/download_apk.py "${appName}"`
        );

        if (stderr) console.error(stderr);

        const apkPath = stdout.trim();

        if (!apkPath || !fs.existsSync(apkPath)) {
            return sock.sendMessage(from, {
                text: "❌ APK gagal diunduh."
            }, { quoted: msg });
        }

        const fileSizeMB = fs.statSync(apkPath).size / (1024 * 1024);

        // BATAS WA
        if (fileSizeMB > 100) {
            fs.unlinkSync(apkPath);
            return sock.sendMessage(from, {
                text: `⚠️ APK terlalu besar (${fileSizeMB.toFixed(1)} MB)\nWA tidak mendukung.`
            }, { quoted: msg });
        }

        await sock.sendMessage(from, {
            document: fs.readFileSync(apkPath),
            mimetype: "application/vnd.android.package-archive",
            fileName: `${appName}.apk`,
            caption: `📦 *${appName}*`
        }, { quoted: msg });

        fs.unlinkSync(apkPath);
        await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error(err);
        sock.sendMessage(from, {
            text: "⚠️ Terjadi kesalahan saat download APK."
        }, { quoted: msg });
    }
}
