// commands/q.js (ESM version)
import fs from 'fs';
import path from 'path';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export async function sendMediaBack({ sock, msg }) {
    try {

        await sock.sendMessage(msg.key.remoteJid, {
            react: {
                text: '⏳', // Bisa diganti: '📤', '🔄', '🕒'
                key: msg.key
            }
        });

        if (!msg || !msg.message) {
            console.warn('❗ msg.message tidak ditemukan!');
            return;
        }

        let quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) return;

        // unwrap viewOnce
        if (quoted.viewOnceMessage) {
            quoted = quoted.viewOnceMessage.message;
        }

        // unwrap ephemeral
        if (quoted.ephemeralMessage) {
            quoted = quoted.ephemeralMessage.message;
        }
        if (!quoted) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `
╭──📥 KIRIM ULANG MEDIA ──⬣
│❗ Silakan *reply* ke media View Once 
│   (gambar atau video) yang ingin dikirim ulang.
╰⬣
`.trim()
            }, { quoted: msg });
            return;
        }

        const mediaType = Object.keys(quoted).find(
            v => v === "imageMessage" || v === "videoMessage"
        );
        if (mediaType !== 'imageMessage' && mediaType !== 'videoMessage') {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `
╭──⚠️ BUKAN MEDIA VIEW ONCE ──⬣
│❗ Pesan yang direply bukan media *View Once*.
╰⬣
`.trim()
            }, { quoted: msg });
            return;
        }

        const quotedMsg = {
            key: {
                remoteJid: msg.key.remoteJid,
                id: msg.key.id,
                participant: msg.key.participant
            },
            message: quoted
        };

        const buffer = await downloadMediaMessage(
            quotedMsg,
            "buffer",
            {},
            {
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            }
        );
        const fileExt = mediaType === 'imageMessage' ? 'jpg' : 'mp4';
        const tempDir = './tmp';
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const filePath = path.join(tempDir, `${Date.now()}.${fileExt}`);
        fs.writeFileSync(filePath, buffer);

        const timestamp = new Date().toLocaleString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Jakarta'
        });

        const sendPayload = {
            [mediaType === 'imageMessage' ? 'image' : 'video']: fs.readFileSync(filePath),
            caption: `
╭──🔁 VIEW ONCE REPLAY ──⬣
│📎 Jenis Media : ${mediaType === 'imageMessage' ? 'Gambar 🖼️' : 'Video 🎞️'}
│🔄 Status       : Berhasil diambil ulang
│🕒 Timestamp    : ${timestamp}
╰⬣

🧐 Ini adalah hasil pengambilan ulang media *View Once*.
`.trim()
        };

        await sock.sendMessage(msg.key.remoteJid, sendPayload, { quoted: msg });

        fs.unlinkSync(filePath); // hapus file sementara
    } catch (err) {
        console.error('❌ Gagal kirim ulang media:', err);
        await sock.sendMessage(msg.key.remoteJid, {
            react: {
                text: '❌',
                key: msg.key
            }
        });

        await sock.sendMessage(msg.key.remoteJid, {
            text: `
╭──🚫 GAGAL MENGIRIM ──⬣
│❌ Terjadi kesalahan saat mengirim ulang media.
╰⬣
`.trim()
        }, { quoted: msg });
    }
}
