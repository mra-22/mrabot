import sharp from 'sharp'
import fs from 'fs-extra'
import path from 'path'
import { Sticker } from 'wa-sticker-formatter'
import { exec } from 'child_process'
import { pipeline } from 'stream/promises'
import { downloadMediaMessage } from '@whiskeysockets/baileys'

const tmpDir = path.resolve('tmp')
await fs.ensureDir(tmpDir)

const emojiFolder = path.resolve('assets/emojis')
const fontSize = 42
const lineHeight = fontSize + 12
/**
 * 🔤 Convert emoji to local SVG if available
 */
export function parseEmojiToSvg(emoji) {
    const codepoints = Array.from(emoji)
        .map(c => c.codePointAt(0).toString(16))
        .join('-')
    const filePath = path.join(twemojiFolder, `${codepoints}.svg`)
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8')
    }
    return `<text x="50%" y="50%" fill="red" dominant-baseline="middle" text-anchor="middle">${emoji}</text>`
}
/**
 * 🧹 Hapus semua file di folder tmp
 */
async function cleanupTmpFolder() {
    try {
        const files = await fs.readdir(tmpDir)

        for (const file of files) {
            const filePath = path.join(tmpDir, file)

            try {
                await fs.unlink(filePath)
            } catch (err) {

                // kalau file masih dipakai, tunggu lalu coba lagi
                if (err.code === 'EBUSY') {
                    await new Promise(r => setTimeout(r, 500))

                    try {
                        await fs.unlink(filePath)
                    } catch (e) {
                        console.log('⚠️ Skip file (still locked):', filePath)
                    }
                } else {
                    console.error('❌ Gagal hapus:', filePath, err)
                }

            }
        }

    } catch (e) {
        console.error('❌ Gagal hapus tmp:', e)
    }
}
/**
 * 📥 Download image/video/sticker message
 */
async function downloadAndSaveMessage({ sock, msg, from, type = 'image' }) {
    let messageToDownload
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo

    // Determine which message to download
    if (type === 'image' && quoted?.imageMessage) {
        messageToDownload = {
            key: { remoteJid: from, id: contextInfo.stanzaId, participant: contextInfo.participant },
            message: { imageMessage: quoted.imageMessage }
        }
    } else if (type === 'video' && quoted?.videoMessage) {
        messageToDownload = {
            key: { remoteJid: from, id: contextInfo.stanzaId, participant: contextInfo.participant },
            message: { videoMessage: quoted.videoMessage }
        }
    } else if (quoted?.stickerMessage) {
        messageToDownload = {
            key: { remoteJid: from, id: contextInfo.stanzaId, participant: contextInfo.participant },
            message: { stickerMessage: quoted.stickerMessage }
        }
    } else if (msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.stickerMessage) {
        messageToDownload = msg
    }

    if (!messageToDownload) return null

    const ext = type === 'video' ? '.mp4' : (type === 'image' ? '.jpg' : '.webp')
    const filePath = path.join(tmpDir, `download_${Date.now()}${ext}`)

    const stream = await downloadMediaMessage(messageToDownload, 'stream', {}, { logger: sock.logger })
    await pipeline(stream, fs.createWriteStream(filePath))

    return filePath
}
/**
 * 🖼 Convert sticker → image
 */
export async function toImg({ sock, msg, from }) {
    await sock.sendMessage(from, {
        react: {
            text: '⏳',
            key: msg.key
        }
    })

    let filePath
    try {

        // download sticker
        filePath = await downloadAndSaveMessage({ sock, msg, from })

        if (!filePath) {
            return await sock.sendMessage(from, {
                text: `╭──⚠️ *FORMAT!* ──⬣
┃ 📌 Reply sticker dengan
┃ *.toimg*
╰⬣`
            }, { quoted: msg })
        }

        const output = path.join(tmpDir, `toimg_${Date.now()}.png`)

        // convert webp -> png
        await sharp(filePath)
            .png()
            .toFile(output)

        const buffer = await fs.readFile(output)

        await sock.sendMessage(from, {
            image: buffer,
            caption: "🖼️ *Sticker berhasil diubah ke gambar!*"
        }, { quoted: msg })

    } catch (err) {
        console.error("❌ Error toImg:", err)

        await sock.sendMessage(from, {
            react: {
                text: '❌',
                key: msg.key
            }
        })

        await sock.sendMessage(from, {
            text: `╭──⚠️ *ERROR!* ──⬣
┃ 🚫 Gagal convert sticker.
╰⬣`
        }, { quoted: msg })

    } finally {
        await new Promise(r => setTimeout(r, 800))
        await cleanupTmpFolder()
    }
}
/**
 * 🖼 Create sticker from image
 */
export async function stickerFromImage({ sock, msg, from }) {
    await sock.sendMessage(from, {
        react: {
            text: '⏳', // atau bisa ganti jadi '🕐', '🎨', dll
            key: msg.key
        }
    })

    let filePath
    try {
        filePath = await downloadAndSaveMessage({ sock, msg, from, type: 'image' })
        if (!filePath) {
            return await sock.sendMessage(from, {
                text: `╭──🚫 *ERROR!* ──⬣ \n┃ 📷 Kirim atau reply gambar dengan *.stkr*\n╰⬣`
            }, { quoted: msg })
        }

        console.log('🖼 Membuat sticker dari gambar...')
        const buffer = await sharp(filePath)
            .resize(512, 512, { fit: 'cover' })
            .webp()
            .toBuffer()

        const sticker = new Sticker(buffer, {
            pack: 'MR.A BOT',
            author: 'Sticker Image',
            type: 'full',
            quality: 70,
        })

        const stickerBuffer = await sticker.toBuffer()
        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg })
    } catch (err) {
        console.error('❌ Error stickerFromImage:', err)

        // ❌ Ganti reaksi jadi error
        await sock.sendMessage(from, {
            react: {
                text: '❌',
                key: msg.key
            }
        })

        await sock.sendMessage(from, {
            text: `╭──⚠️ *ERROR!* ──⬣\n┃ 🔧 Terjadi kesalahan.\n┃ 🔄 Coba lagi nanti!\n╰⬣`
        }, { quoted: msg })
    } finally {
        await new Promise(r => setTimeout(r, 800))
        await cleanupTmpFolder()
    }
}


/**
 * ✅ Multi-line text + emoji inline with stroke & shadow
 */
export async function stickerFromText({ sock, msg, from, text }) {
    await sock.sendMessage(from, {
        react: {
            text: '⏳', // atau bisa ganti jadi '🕐', '🎨', dll
            key: msg.key
        }
    })
    try {
        if (!text.includes(' ')) {
            return await sock.sendMessage(from, {
                text: `╭──⚠️ *📝 FORMAT!* ──⬣\n┃ *.strss <text>* \n╰⬣`
            }, { quoted: msg })
        }

        const emojiFolder = path.resolve('./assets/emojis')
        const fontSize = 42
        const lineHeight = fontSize + 12
        const paddingX = 15
        const paddingY = 20
        const maxLineWidth = 250

        let emojiBuffers = {}

        // Load emojis PNG
        for (let char of text) {
            if (/\p{Emoji}/u.test(char)) {
                if (!emojiBuffers[char]) {
                    const codepoints = Array.from(char).map(c => c.codePointAt(0).toString(16)).join('-')
                    const emojiPath = path.join(emojiFolder, `emoji_u${codepoints}.png`)
                    if (fs.existsSync(emojiPath)) {
                        emojiBuffers[char] = await sharp(emojiPath)
                            .resize(fontSize, fontSize)
                            .ensureAlpha()
                            .toBuffer()
                    }
                }
            }
        }

        // Wrap text
        let wrappedLines = []
        let currentLine = ''
        let currentLineWidth = 0
        const words = text.split(' ')
        for (let word of words) {
            let wordWidth = 0
            for (let char of word) {
                wordWidth += emojiBuffers[char] ? fontSize : (fontSize * 0.6)
            }
            if (currentLineWidth + wordWidth > maxLineWidth && currentLine !== '') {
                wrappedLines.push(currentLine.trim())
                currentLine = word + ' '
                currentLineWidth = wordWidth
            } else {
                currentLine += word + ' '
                currentLineWidth += wordWidth + (fontSize * 0.4)
            }
        }
        if (currentLine) wrappedLines.push(currentLine.trim())

        // Calculate max width
        let maxWidth = 0
        for (let line of wrappedLines) {
            let lineWidth = 0
            let segments = line.split(/(\p{Emoji}+)/u)
            for (let segment of segments) {
                lineWidth += emojiBuffers[segment] ? fontSize : segment.length * (fontSize * 0.6)
            }
            if (lineWidth > maxWidth) maxWidth = lineWidth
        }

        const width = Math.ceil(maxWidth + paddingX * 2)
        const height = wrappedLines.length * lineHeight + paddingY * 2

        // Transparent background
        let base = sharp({
            create: {
                width,
                height,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })

        let compositeLayers = []
        let currentY = paddingY

        for (let line of wrappedLines) {
            let currentX = paddingX
            let segments = line.split(/(\p{Emoji}+)/u)
            for (let segment of segments) {
                if (emojiBuffers[segment]) {
                    compositeLayers.push({
                        input: emojiBuffers[segment],
                        top: currentY,
                        left: Math.round(currentX)
                    })
                    currentX += fontSize
                } else if (segment) {
                    const approxWidth = segment.length * (fontSize * 0.6)
                    const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${approxWidth}" height="${lineHeight}">
                        <style>
                            .t { fill: black; font-size: ${fontSize}px; font-family: sans-serif; }
                        </style>
                        <text x="0" y="${fontSize}" class="t">${segment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
                    </svg>`
                    const textBuffer = await sharp(Buffer.from(svgText)).png().toBuffer()
                    const meta = await sharp(textBuffer).metadata()
                    compositeLayers.push({
                        input: textBuffer,
                        top: currentY,
                        left: Math.round(currentX)
                    })
                    currentX += meta.width
                }
            }
            currentY += lineHeight
        }

        // Composite jadi PNG warna
        const finalPng = await base
            .composite(compositeLayers)
            .toColourspace('srgb')
            .withMetadata()
            .png()
            .toBuffer()

        // Convert ke sticker
        const sticker = new Sticker(finalPng, {
            pack: 'MR.A BOT',
            author: 'Multi Emoji',
            type: 'full'
        })
        await sock.sendMessage(from, await sticker.toMessage(), { quoted: msg })

    } catch (e) {
        console.error('❌ Error stickerFromText:', e) // ❌ Ganti reaksi jadi error
        await sock.sendMessage(from, {
            react: {
                text: '❌',
                key: msg.key
            }
        })
        await sock.sendMessage(from, { text: `❌ Error stickerFromText: ${e}` }, { quoted: msg })
    }
}

/**
 * 📝 Create meme sticker
 */

export async function memeSticker({ sock, msg, from, text }) {
    await sock.sendMessage(from, {
        react: {
            text: '⏳', // atau bisa ganti jadi '🕐', '🎨', dll
            key: msg.key
        }
    })
    let filePath
    try {
        if (!text.includes('|')) {
            return await sock.sendMessage(from, {
                text: `╭──⚠️ *📝 FORMAT!* ──⬣\n┃ Gunakan:\n┃ *.stmm atas|bawah*\n╰⬣`
            }, { quoted: msg })
        }

        const [topText, bottomText] = text.split('|').map(s => s.trim())
        filePath = await downloadAndSaveMessage({ sock, msg, from, type: 'image' })

        if (!filePath || !(await fs.pathExists(filePath))) {
            return await sock.sendMessage(from, {
                text: `╭──⚠️ *ERROR!* ──⬣\n┃ 📷 Kirim atau reply gambar.\n╰⬣`
            }, { quoted: msg })
        }

        // Parse emoji unik dari text
        let emojis = new Set()
        for (let char of topText + bottomText) {
            if (/\p{Emoji}/u.test(char)) emojis.add(char)
        }

        let emojiBuffers = {}
        for (let emoji of emojis) {
            const codepoints = Array.from(emoji).map(c => c.codePointAt(0).toString(16)).join('-')
            const emojiPath = path.join(emojiFolder, `${codepoints}.png`)
            if (await fs.pathExists(emojiPath)) {
                emojiBuffers[emoji] = await sharp(emojiPath).resize(fontSize, fontSize).toBuffer()
            }
        }

        let composites = []
        await buildLineComposite(topText, 10, emojiBuffers, composites)
        await buildLineComposite(bottomText, 512 - lineHeight - 35, emojiBuffers, composites)

        const memeBuffer = await sharp(filePath)
            .resize(512, 512, { fit: 'cover', position: 'entropy' })
            .ensureAlpha()
            .composite(composites)
            .webp({ quality: 90 })
            .toBuffer()

        const sticker = new Sticker(memeBuffer, {
            pack: 'MR.A BOT',
            author: 'Emoji Meme',
            type: 'full',
            quality: 80
        })
        await sock.sendMessage(from, await sticker.toMessage(), { quoted: msg })

    } catch (e) {
        console.error('❌ Error memeSticker:', e)
        // ❌ Ganti reaksi jadi error
        await sock.sendMessage(from, {
            react: {
                text: '❌',
                key: msg.key
            }
        })
        await sock.sendMessage(from, {
            text: `╭──⚠️ *ERROR!* ──⬣\n┃ ❌ Gagal membuat stiker meme.\n╰⬣`
        }, { quoted: msg })
    } finally {
        await new Promise(r => setTimeout(r, 800))
        await cleanupTmpFolder()
    }
}

async function buildLineComposite(text, yPos, emojiBuffers, composites) {
    const fontSize = 60;
    const lineHeight = 80;
    const canvasWidth = 512;
    const maxWidth = 460; // biar ga mepet pinggir

    // 🔥 WRAP TEXT MANUAL
    function wrapText(str) {
        const words = str.split(" ");
        let lines = [];
        let current = "";

        for (let word of words) {
            const testLine = current + word + " ";
            const testWidth = testLine.length * (fontSize * 0.55);

            if (testWidth > maxWidth) {
                lines.push(current);
                current = word + " ";
            } else {
                current = testLine;
            }
        }

        if (current) lines.push(current);
        return lines;
    }

    const lines = wrapText(text);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const segments = line.split(/(\p{Emoji}+)/u);

        let totalWidth = 0;
        let segmentWidths = [];

        for (let segment of segments) {
            if (emojiBuffers[segment]) {
                segmentWidths.push({ type: 'emoji', width: fontSize, content: segment });
                totalWidth += fontSize;
            } else if (segment) {
                const realWidth = segment.length * (fontSize * 0.55);
                segmentWidths.push({ type: 'text', width: realWidth, content: segment });
                totalWidth += realWidth;
            }
        }

        let x = Math.max(10, (canvasWidth - totalWidth) / 2);
        let y = yPos + (i * lineHeight);

        for (let seg of segmentWidths) {
            if (seg.type === 'emoji') {
                composites.push({
                    input: emojiBuffers[seg.content],
                    top: Math.round(y),
                    left: Math.round(x)
                });
                x += seg.width;
            } else {
                const svgText = `
<svg xmlns="http://www.w3.org/2000/svg" width="${seg.width}" height="${lineHeight}">
<style>
.t {
    fill: white;
    stroke: black;
    stroke-width: 6;
    font-family: Arial Black, Impact, sans-serif;
    font-size: ${fontSize}px;
    dominant-baseline: middle;
    text-anchor: start;
}
</style>
<text x="0" y="50%" class="t">${escapeXml(seg.content)}</text>
</svg>`;

                const textBuffer = await sharp(Buffer.from(svgText)).png().toBuffer();
                const meta = await sharp(textBuffer).metadata();

                composites.push({
                    input: textBuffer,
                    top: Math.round(y),
                    left: Math.round(x)
                });

                x += meta.width;
            }
        }
    }
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;'
            case '>': return '&gt;'
            case '&': return '&amp;'
            case '\'': return '&apos;'
            case '"': return '&quot;'
        }
    })
}
/**
 * 🎞 Create animated sticker from video/gif/image
 */
export async function stickerAnimasi({ sock, msg, from }) {
    await sock.sendMessage(from, {
        react: {
            text: '⏳', // atau bisa ganti jadi '🕐', '🎨', dll
            key: msg.key
        }
    })
    let inputFile, outputFile
    try {
        inputFile = await downloadAndSaveMessage({ sock, msg, from, type: 'video' })
            || await downloadAndSaveMessage({ sock, msg, from, type: 'image' })

        if (!inputFile) {
            return await sock.sendMessage(from, {
                text: `╭──⚠️ *🎞 FORMAT!* ──⬣\n┃ Kirim/reply video/gif\n┃ dengan *.stkrnim*\n╰⬣`
            }, { quoted: msg })
        }

        outputFile = path.join(tmpDir, `anim_${Date.now()}.webp`)
        console.log(`🎬 Membuat sticker animasi dari: ${inputFile}`)

        await new Promise((resolve, reject) => {
            const cmd = `ffmpeg -i "${inputFile}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -loop 0 -t 10 -an -vsync 0 -preset default "${outputFile}"`
            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    console.error('❌ FFmpeg error:', stderr)
                    return reject(stderr)
                }
                resolve(stdout)
            })
        })

        // Pakai Sticker Formatter agar ada pack & author
        const sticker = new Sticker(fs.readFileSync(outputFile), {
            pack: 'MR.A BOT',
            author: 'Sticker Anim',
            type: 'full',
            categories: ['🤖', '🎬'],
            quality: 70,
            animated: true
        })
        const stickerBuffer = await sticker.toBuffer()

        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg })

    } catch (err) {
        console.error('❌ Error stickerAnimasi:', err)
        await sock.sendMessage(from, {
            text: `╭──⚠️ *ERROR!* ──⬣\n┃ 🚫 Gagal buat animasi.\n╰⬣`
        }, { quoted: msg })
    } finally {
        await new Promise(r => setTimeout(r, 800))
        await cleanupTmpFolder()
    }
}

export async function stickerReply({ sock, msg, from, text }) {
    await sock.sendMessage(from, {
        react: {
            text: '⏳', // atau bisa ganti jadi '🕐', '🎨', dll
            key: msg.key
        }
    })
    try {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        if (!quoted || !quoted.stickerMessage) {
            return await sock.sendMessage(from, {
                text: `╭──⚠️ *🚀 REPLY STIKER!* ──⬣\n┃ 📌 Reply ke sticker dan tulis:\n┃    *.rstkr pack|author*\n┃    Contoh:\n┃    *.rstkr MR.A|BOT*\n╰━━╰⬣`
            }, { quoted: msg })
        }

        const buffer = await downloadMediaMessage(
            { message: quoted },
            'buffer',
            {}
        )

        let pack = 'MR.A BOT'
        let author = 'Sticker Text'

        if (text) {
            const [p, a] = text.split('|').map(s => s.trim())
            if (p) pack = p
            if (a) author = a
        }

        console.log(`🎨 Membuat sticker baru: pack="${pack}", author="${author}"`)
        const sticker = new Sticker(buffer, {
            pack,
            author,
            type: 'full',
            quality: 70,
        })

        const stickerBuffer = await sticker.toBuffer()
        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg })

    } catch (err) {
        console.error('❌ Error stickerReply:', err)
        await sock.sendMessage(from, {
            text: `╭──⚠️ *ERROR!* ──⬣\n┃ 🚫 Gagal memproses sticker.\n╰⬣`
        }, { quoted: msg })
    } finally {
        await new Promise(r => setTimeout(r, 800))
        await cleanupTmpFolder()
    }
}
