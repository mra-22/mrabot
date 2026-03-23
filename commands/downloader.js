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
╰⬣`
        }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

    await sock.sendMessage(from, {
        text: `🔍 Mencari lagu *${query}*...`
    }, { quoted: msg });

    try {
        const { stdout, stderr } = await execPromise(
        `node ./moduls/downloader-gg.cjs ${JSON.stringify(query)}`
        );
        
        if (stderr) console.error(stderr);
        
        const mp3Match = stdout.match(/::MP3::(.+)/);
        const infoMatch = stdout.match(/::INFO::({.*})/);
        if (!mp3Match) {
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
            return sock.sendMessage(from, {
                text: `❌ Gagal mengunduh lagu.`
            }, { quoted: msg });
        }

        const mp3Path = mp3Match[1].trim();
        let info = {};

        if (infoMatch) {
            try {
                info = JSON.parse(infoMatch[1]);
            } catch { }
        }

        const caption = `╭━━━〔 🎵 PLAY MUSIC 〕━━━⬣
┃ 🎧 Judul   : ${info.title || "-"}
┃ 📺 Channel : ${info.uploader || "-"}
┃ ⏱️ Durasi  : ${info.duration || "-"}
╰━━━━━━━━━━━━━━━━⬣`;

        if (info.thumbnail) {
            await sock.sendMessage(from, {
                image: { url: info.thumbnail },
                caption
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                text: caption
            }, { quoted: msg });
        }

        // 🔥 KIRIM AUDIO
        const audioBuffer = fs.readFileSync(mp3Path);

        await sock.sendMessage(from, {
            audio: audioBuffer,
            mimetype: "audio/mpeg",
            fileName: "music.mp3"
        }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error(err);

        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });

        await sock.sendMessage(from, {
            text: `⚠️ Gagal memproses lagu.`
        }, { quoted: msg });
    }
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
