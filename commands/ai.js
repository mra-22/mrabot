import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import mime from 'mime-types';
import fs from 'fs';
import path from 'path';
const dataPath = path.join('./database/gambar.json');
import { getSenderRawId, resolveToMainId } from '../moduls/user.js';

import { exec } from "child_process";

function runPython(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
        const cmd = `py "${scriptPath}" ${args.map(a => `"${a}"`).join(" ")}`;

        exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(stderr || error.message));
            }
            resolve({ stdout, stderr });
        });
    });
}

function isInstagramUrl(url = '') {
    return /instagram\.com|cdninstagram\.com/i.test(url);
}


if (!fs.existsSync('./database')) {
    fs.mkdirSync('./database');
}

// Load data jika ada
let usedImagesMap = {};
if (fs.existsSync(dataPath)) {
    try {
        usedImagesMap = JSON.parse(fs.readFileSync(dataPath));
    } catch (err) {
        console.error('❌ Gagal load gambar.json:', err);
    }
}

// Fungsi simpan
function saveUsedImages() {
    fs.writeFileSync(dataPath, JSON.stringify(usedImagesMap, null, 2));
}


const blacklistPath = path.join('../database/Blacklist.json');

let imageUrlBlacklist = [];
if (fs.existsSync(blacklistPath)) {
    imageUrlBlacklist = JSON.parse(fs.readFileSync(blacklistPath));
}

function saveBlacklist() {
    fs.writeFileSync(dataPath, JSON.stringify(usedImagesMap, null, 2));
}


// ─── 🔮 AI Chat: .om ─────────────────────────
export async function omCommand({ sock, msg, from, text }) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (msg?.key) {
        await sock.sendMessage(from, {
            react: { text: '⏳', key: msg.key }
        });
    }

    if (!apiKey) {
        return sock.sendMessage(from, {
            text: "❌ API Key OpenRouter tidak ditemukan."
        }, { quoted: msg });
    }

    const userMessage = text.replace('.om', '').trim();
    if (!userMessage) {
        return sock.sendMessage(from, {
            text: "❗ Contoh penggunaan:\n.om siapa presiden RI?"
        }, { quoted: msg });
    }

    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "deepseek/deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "Kamu adalah AI yang selalu menjawab dalam Bahasa Indonesia dengan jelas, sopan, dan mudah dipahami."
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                max_tokens: 300,
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.data.choices?.length) {
            throw new Error("Jawaban AI kosong");
        }

        const aiResponse = response.data.choices[0].message.content;

        await sock.sendMessage(from, {
            text: `╭──🧠 *AI Bot* ──⬣\n│ ${aiResponse}\n╰⬣`
        }, { quoted: msg });

    } catch (err) {
        console.error("OpenRouter Error:", err.response?.data || err.message);
        await sock.sendMessage(from, {
            text: "🚫 Terjadi kesalahan saat memproses pertanyaan. Silakan coba lagi."
        }, { quoted: msg });
    }
}

export async function gambarCommand({ sock, msg, from, text }) {
    await sock.sendMessage(from, {
        react: { text: '⏳', key: msg.key }
    });

    const query = text.replace('!gam', '').trim();
    if (!query) {
        return sock.sendMessage(from, {
            text: `
╭──🖼️ *FORMAT GAMBAR* ──⬣
│ ❗ Masukkan kata kunci pencarian.
│ 📌 Contoh: *!gam kucing lucu*
╰⬣`.trim()
        }, { quoted: msg });
    }

    const userDB = JSON.parse(fs.readFileSync('./database/user.json', 'utf-8'));
    const rawId = getSenderRawId(msg); // bisa `msg.key.participant || msg.key.remoteJid`
    const userKey = resolveToMainId(rawId);
    const user = userDB?.[String(userKey)] ?? null;

    if (!user) {
        return sock.sendMessage(from, {
            text: `
╭──🖼️ *GAMBAR* ──⬣
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
╭──🖼️ *GAMBAR* ──⬣
│ 🚫 Limit unduhan gambar kamu habis.
│ 🎁 Gunakan *!lmclaim* untuk klaim limit harian.
╰⬣`.trim()
        }, { quoted: msg });
    }

    try {
        const response = await axios.post('https://google.serper.dev/images', {
            q: query
        }, {
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        let images = response.data.images || [];
        if (images.length === 0) {
            return sock.sendMessage(from, {
                text: `
╭─ ❌ *GAMBAR TIDAK DITEMUKAN* ─⬣
│ 🔍 Tidak ada hasil untuk *${query}*
╰⬣`.trim()
            }, { quoted: msg });
        }

        // Filter
        images = images.filter(img =>
            img.imageUrl &&
            img.imageUrl.startsWith('http') &&
            !imageUrlBlacklist.includes(img.imageUrl) &&
            !isInstagramUrl(img.imageUrl) &&              // ❌ BLOK INSTAGRAM
            !isInstagramUrl(img.source || '')
        );


        const key = `${from}-${query}`;
        usedImagesMap[key] = usedImagesMap[key] || [];
        const unusedImages = images.filter(img => !usedImagesMap[key].includes(img.imageUrl));

        if (unusedImages.length === 0) {
            usedImagesMap[key] = [];
            saveUsedImages();
            return sock.sendMessage(from, {
                text: `
╭─ ✅ *SEMUA GAMBAR SUDAH DILIHAT* ─⬣
│ 🔁 Semua gambar untuk *${query}* sudah pernah dikirim.
│ 📌 Reset ulang, silakan ketik *!gam ${query}* lagi.
╰⬣`.trim()
            }, { quoted: msg });
        }

        const selectedImage = unusedImages[Math.floor(Math.random() * unusedImages.length)];
        let imageBuffer = null;

        try {
            if (isInstagramUrl(selectedImage.imageUrl)) {
                imageUrlBlacklist.push(selectedImage.imageUrl);
                saveBlacklist();
                throw new Error('INSTAGRAM_BLOCKED');
            }

            const imageResponse = await axios.get(selectedImage.imageUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'image/*,*/*;q=0.8',
                    'Referer': 'https://www.google.com/'
                }
            });

            if (imageResponse.status === 200 && imageResponse.data.length > 1000) {
                imageBuffer = imageResponse.data;
            }
        } catch (e) {
            console.warn(`⚠️ Skip gambar:`, selectedImage.imageUrl);
            imageUrlBlacklist.push(selectedImage.imageUrl);
            saveBlacklist();
        }

        if (!imageBuffer) {
            return sock.sendMessage(from, {
                text: `
╭─❌ *GAGAL MENGAMBIL GAMBAR* ─⬣
│ ⚠️ Gambar diblokir atau gagal diakses.
╰⬣`.trim()
            }, { quoted: msg });
        }

        // Kirim gambar
        usedImagesMap[key].push(selectedImage.imageUrl);
        saveUsedImages();

        const mimeType = mime.lookup(selectedImage.imageUrl) || 'image/jpeg';

        await sock.sendMessage(from, {
            image: imageBuffer,
            mimetype: mimeType,
            caption: `╭──📸 *Gambar:* ─⬣\n│ ${query}\n│🌐 Sumber: ${selectedImage.source}\n╰⬣`
        }, { quoted: msg });

        // Kurangi limit
        user.Vidlimit -= 1;
        userDB[userKey] = user;
        // pastikan update objek user di userDB
        fs.writeFileSync('./database/user.json', JSON.stringify(userDB, null, 2));

        await sock.sendMessage(from, {
            react: { text: '✅', key: msg.key }
        });

    } catch (err) {
        console.error('❌ Error gambarCommand:', err);
        return sock.sendMessage(from, {
            text: `
╭──❌ *ERROR GAMBAR* ──⬣
│ 🚫 Terjadi kesalahan saat mengambil gambar.
╰⬣`.trim()
        }, { quoted: msg });
    }
}


// ─── 🌦️ Cuaca: !cuaca ────────────────────────
export async function cuacaCommand({ sock, msg, from, text }) {
    const query = text.replace('!cuaca', '').trim();
    if (!query) {
        return sock.sendMessage(from, {
            text: `
╭──🌦️ *FORMAT CUACA* ──⬣
│ ❗ Masukkan nama kota!
│ 📌 Contoh: *!cuaca Bandung*
╰⬣
            `.trim()
        }, { quoted: msg });
    }

    try {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${apiKey}&units=metric&lang=id`;

        const { data } = await axios.get(url);

        const lokasi = `${data.name}, ${data.sys.country}`;
        const suhu = data.main.temp;
        const deskripsi = data.weather[0].description;
        const kelembapan = data.main.humidity;
        const angin = data.wind.speed;

        const pesan = `
╭──🌤 CUACA SAAT INI ──⬣
│ 📍 Lokasi      : ${lokasi}
│ 📋 Cuaca      : ${deskripsi}
│ 🌡 Suhu        : ${suhu}°C
│ 💧 Kelembapan : ${kelembapan}%
│ 💨 Angin       : ${angin} m/s
╰⬣
        `.trim();

        await sock.sendMessage(from, { text: pesan }, { quoted: msg });
    } catch (err) {
        console.error(err);
        await sock.sendMessage(from, {
            text: `
╭──❌ *CUACA GAGAL* ──⬣
│ 🚫 Kota tidak ditemukan atau error API.
╰⬣
            `.trim()
        }, { quoted: msg });
    }
}

export async function vidCommand({ sock, msg, from, text }) {
    await sock.sendMessage(from, {
        react: { text: '⏳', key: msg.key }
    });

    const query = text.replace('!vid', '').trim();
    if (!query) {
        return sock.sendMessage(from, {
            text: `
╭── 🎬 *FORMAT VIDEO* ─⬣
│ ❗ Masukkan kata kunci atau link video.
│ 📌 Contoh: *!vid ikan tomat*
╰⬣`.trim()
        }, { quoted: msg });
    }

    // === CEK LIMIT USER ===
    const userDB = JSON.parse(fs.readFileSync('./database/user.json', 'utf-8'));
    const rawId = getSenderRawId(msg); // bisa `msg.key.participant || msg.key.remoteJid`
    const userKey = resolveToMainId(rawId);
    const user = userDB?.[String(userKey)] ?? null;

    if (!user) {
        return sock.sendMessage(from, {
            text: `╭──🎬 VIDEO ──⬣
│ 🚫 Kamu belum terdaftar.
│ ✅ Gunakan *!daftar* untuk mendaftar!
╰⬣`
        }, { quoted: msg });
    }

    if (typeof user.Vidlimit !== 'number') user.Vidlimit = 0;

    if (user.Vidlimit <= 0) {
        return sock.sendMessage(from, {
            text: `╭──🎬 VIDEO ──⬣
│ 🚫 Limit unduhan video kamu habis.
│ 🎁 Gunakan *!lmclaim* untuk klaim limit harian.
╰⬣`
        }, { quoted: msg });
    }

    // === PROSES DOWNLOAD VIDEO ===
    try {
        const searchRes = await axios.post('https://google.serper.dev/videos', {
            q: query
        }, {
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        const videoUrl = searchRes.data.videos?.[0]?.link;
        if (!videoUrl) {
            return sock.sendMessage(from, {
                text: `
╭─❌ *VIDEO TIDAK DITEMUKAN* ─⬣
│ 🔍 Tidak ada hasil untuk *${query}*
╰⬣`.trim()
            }, { quoted: msg });
        }

        const { stdout, stderr } = await runPython('moduls/downloader_vid.py', [query]);

        const combinedOutput = `${stdout}\n${stderr}`;
        const match = combinedOutput.match(/\[VIDDONE\](.*?\.mp4)/);
        const filePath = match ? match[1].replace(/\\\\/g, '\\').trim() : null;

        if (!filePath || !fs.existsSync(filePath)) {
            return sock.sendMessage(from, {
                text: `
╭─❌ *GAGAL UNDUH VIDEO* ─⬣
│ 🚫 Gagal mengunduh atau mengonversi video.
╰⬣`.trim()
            }, { quoted: msg });
        }

        await sock.sendMessage(from, {
            video: { url: filePath },
            caption: `╭──🎥 *Video:* ─⬣\n│ ${query}\n│🌐 ${videoUrl}\n╰⬣`
        }, { quoted: msg });

        // Hapus file setelah kirim
        fs.unlinkSync(filePath);
        // Kurangi limit dan simpan
        user.Vidlimit -= 1;
        userDB[userKey] = user;
        fs.writeFileSync('./database/user.json', JSON.stringify(userDB, null, 2));
        await sock.sendMessage(from, {
            react: { text: '✅', key: msg.key }
        });

    } catch (err) {
        console.error("❌ Error di !vid:", err);
        return sock.sendMessage(from, {
            text: `
╭─❌ *KESALAHAN* ─⬣
│ 🚫 Terjadi error saat proses pencarian atau download.
│ 💡 ${err.message}
╰⬣`.trim()
        }, { quoted: msg });
    }
}
