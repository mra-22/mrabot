const fs = require("fs");
const path = require("path");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");

const query = process.argv.slice(2).join(" ");

if (!query) {
    console.error("[DOWNLOAD ERROR] Query kosong");
    process.exit(1);
}

const outputDir = "audios";
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

function sanitize(text) {
    return text.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

// 🔥 retry helper
async function retry(fn, max = 3) {
    let err;
    for (let i = 0; i < max; i++) {
        try {
            return await fn();
        } catch (e) {
            err = e;
        }
    }
    throw err;
}

(async () => {
    try {
        // ================= SEARCH =================
        const search = await yts(query);

        if (!search.videos.length) {
            throw new Error("Lagu tidak ditemukan");
        }

        const video = search.videos[0];
        const title = sanitize(video.title);
        const mp4Path = path.join(outputDir, `${title}.mp4`);
        const mp3Path = path.join(outputDir, `${title}.mp3`);

        // ================= GET INFO =================
        const info = await retry(() =>
            ytdl.getInfo(video.url, {
                requestOptions: {
                    headers: {
                        "user-agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                    }
                }
            })
        );

        if (!info || !info.formats) {
            throw new Error("Gagal ambil format video");
        }

        // ================= FILTER AUDIO =================
        const audioFormats = info.formats
            .filter(f => f.hasAudio && !f.hasVideo);

        if (!audioFormats.length) {
            throw new Error("Format audio tidak ditemukan");
        }

        // 🔥 pilih bitrate terbaik
        audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

        const bestAudio = audioFormats[0];

        // ================= DOWNLOAD =================
        await new Promise((resolve, reject) => {
            const stream = ytdl.downloadFromInfo(info, {
                format: bestAudio,
                requestOptions: {
                    headers: {
                        "user-agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                    }
                }
            });

            const file = fs.createWriteStream(mp4Path);

            stream.pipe(file);

            stream.on("error", reject);
            file.on("finish", resolve);
            file.on("error", reject);
        });

        if (!fs.existsSync(mp4Path)) {
            throw new Error("Download gagal");
        }

        // ================= CONVERT =================
        await new Promise((resolve, reject) => {
            ffmpeg(mp4Path)
                .audioBitrate(128)
                .save(mp3Path)
                .on("end", resolve)
                .on("error", reject);
        });

        fs.unlinkSync(mp4Path);

        // ================= OUTPUT =================
        const result = {
            title: video.title,
            uploader: video.author.name,
            duration: video.seconds,
            thumbnail: video.thumbnail
        };

        console.log(`::MP3::${mp3Path}`);
        console.log(`::INFO::${JSON.stringify(result)}`);

    } catch (err) {
        console.error("[DOWNLOAD ERROR]", err.message);
        process.exit(1);
    }
})();
