const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const query = process.argv.slice(2).join(" ");

if (!query) {
    console.error("[ERROR] Query kosong");
    process.exit(1);
}

// 🔥 SCRAPE YOUTUBE SEARCH (tanpa API)
async function searchYouTube(q) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

    const { data } = await axios.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const videoIdMatch = data.match(/"videoId":"(.*?)"/);

    if (!videoIdMatch) throw new Error("Video tidak ditemukan");

    const videoId = videoIdMatch[1];

    return {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId
    };
}

// 🔥 AMBIL AUDIO VIA PIPED (SELF HOST OPTIONAL)
async function getAudioLink(videoId) {
    const api = `https://piped.video/api/v1/streams/${videoId}`;

    const { data } = await axios.get(api);

    const audio = data.audioStreams
        .sort((a, b) => b.bitrate - a.bitrate)[0];

    if (!audio) throw new Error("Audio tidak tersedia");

    return {
        url: audio.url,
        title: data.title,
        uploader: data.uploader,
        duration: data.duration,
        thumbnail: data.thumbnailUrl
    };
}

(async () => {
    try {
        const search = await searchYouTube(query);
        const info = await getAudioLink(search.videoId);

        const safeTitle = info.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

        const mp4Path = path.join("audios", `${safeTitle}.mp4`);
        const mp3Path = path.join("audios", `${safeTitle}.mp3`);

        console.log("DOWNLOAD:", info.title);

        // 🔥 DOWNLOAD FILE
        const response = await axios({
            url: info.url,
            method: "GET",
            responseType: "stream"
        });

        const writer = fs.createWriteStream(mp4Path);
        response.data.pipe(writer);

        writer.on("finish", () => {
            // 🔥 CONVERT
            ffmpeg(mp4Path)
                .audioBitrate(192)
                .save(mp3Path)
                .on("end", () => {
                    fs.unlinkSync(mp4Path);

                    console.log(`::MP3::${mp3Path}`);
                    console.log(`::INFO::${JSON.stringify(info)}`);
                })
                .on("error", (err) => {
                    console.error("[FFMPEG ERROR]", err);
                    process.exit(1);
                });
        });

    } catch (err) {
        console.error("[DOWNLOAD ERROR]", err.message);
        process.exit(1);
    }
})();
