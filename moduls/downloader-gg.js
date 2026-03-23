const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

ffmpeg.setFfmpegPath(ffmpegPath);

// 🔍 SEARCH
async function search(query) {
    const res = await axios.get(`https://ytsearch.vercel.app/api?q=${encodeURIComponent(query)}`);
    if (!res.data.result.length) throw new Error("Lagu tidak ditemukan");
    return res.data.result[0];
}

// 🎧 DOWNLOAD + CONVERT
async function downloadAudio(url, title) {
    return new Promise((resolve, reject) => {
        const safe = title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const output = path.join("audios", safe + ".mp3");

        // 🔥 CACHE (biar gak download ulang)
        if (fs.existsSync(output)) {
            console.log("::MP3::" + output);
            return resolve(output);
        }

        const stream = ytdl(url, {
            filter: "audioonly",
            quality: "highestaudio",
            highWaterMark: 1 << 25
        });

        ffmpeg(stream)
            .audioBitrate(320)
            .format("mp3")
            .save(output)
            .on("end", () => {
                console.log("::MP3::" + output);
                resolve(output);
            })
            .on("error", reject);
    });
}

// 🚀 MAIN
(async () => {
    try {
        const query = process.argv.slice(2).join(" ");
        if (!query) throw new Error("Masukkan judul");

        if (!fs.existsSync("audios")) fs.mkdirSync("audios");

        const video = await search(query);
        const file = await downloadAudio(video.url, video.title);

        console.log("::INFO::" + JSON.stringify({
            title: video.title,
            thumbnail: video.thumbnail,
            duration: video.timestamp,
            uploader: video.author?.name || "-"
        }));

    } catch (err) {
        console.error("[DOWNLOAD ERROR]", err.message);
        process.exit(1);
    }
})();
