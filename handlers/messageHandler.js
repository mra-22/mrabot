import fs from 'fs';
import path from 'path';
import { menuCommand, allMenu, menuStiker, tutorialMenu } from '../commands/menu.js';
import { ownerCommand } from '../commands/owner.js';
import { adminMenuCommand } from '../commands/admin.js';
import { omCommand, gambarCommand, cuacaCommand, vidCommand } from '../commands/ai.js';
import { sendMediaBack } from '../commands/q.js';
import { downloaderCommand, play, Apk, Lirik } from '../commands/downloader.js';
import { userCommands, claimVidCommand, tflimitCommand, addLimitCommand, setLimitCommand, remLimitCommand } from "../commands/user.js";
import { bucinCommands } from "../commands/bucin.js";
import {
    funCommands,
    whoamiCommand,
    jawabWhoamiCommand,
    tebakLagu,
    skipLagu,
    clueLagu,
    stoplg,
    tebakGambar,
    skipGambar,
    clueGambar,
    stopgm,
    getRandomWaifu,
    getRandomAnime
} from '../commands/game.js';
import { stickerFromImage, stickerFromText, memeSticker, stickerAnimasi, stickerReply, toImg } from '../commands/tools.js'
import { vidsCommand } from "../commands/vids.js";
import { handleGroupFeatures, groupTagHandler } from '../commands/fiturgrup.js';
const groupCache = new Map();

async function getGroupMetadataCached(jid, sock) {
    if (groupCache.has(jid)) {
        return groupCache.get(jid);
    }
    try {
        const metadata = await sock.groupMetadata(jid);
        groupCache.set(jid, metadata);
        // Cache 1 menit
        setTimeout(() => groupCache.delete(jid), 60_000);
        return metadata;
    } catch (err) {
        console.error('❌ Error metadata:', err.message);
        return null;
    }
}

export default async function messageHandler(m, sock,) {
    const msg = m;
    if (!msg.message || (msg.key && msg.key.remoteJid === "status@broadcast")) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    const metadata = isGroup ? await getGroupMetadataCached(from, sock) : null;
    // ======================
    // GROUP PERMISSION
    // ======================
    let isAdmin = false
    let isBotAdmin = false

    if (isGroup && metadata) {
        const participants = metadata.participants

        const senderJid = msg.key.participant || msg.key.remoteJid
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

        const senderData = participants.find(p => p.id === senderJid)
        const botData = participants.find(p => p.id.startsWith(botJid.split('@')[0]))

        isAdmin = senderData?.admin !== null
        isBotAdmin = botData?.admin !== null
    }
    const type = Object.keys(msg.message)[0];
    const text = (type === "conversation")
        ? msg.message.conversation
        : (msg.message[type]?.text || msg.message[type]?.caption || "");
    // ==== AUTO REPLY: ASSALAMUALAIKUM (REACTION) ====
    const pesanMasuk = text.toLowerCase();
    if (pesanMasuk.includes("Wa'alaikumussalam warahmatullahi wabarakatuh 🌟")) return;
    if (pesanMasuk.includes("assalamualaikum") || pesanMasuk.includes("assalamu'alaikum")) {
        // Kirim reaction emoji
        await sock.sendMessage(from, {
            react: {
                text: '🕌', // Emoji reaction
                key: msg.key, // Reaksikan ke pesan yang dikirim user
            }
        });

        // Opsional: juga balas dengan teks atau stiker
        return sock.sendMessage(from, {
            text: `Wa'alaikumussalam warahmatullahi wabarakatuh 🌟`,
        }, { quoted: msg });
    }
    // ANTI SPAM — Jangan balas pesan bot sendiri
    if (msg.key.fromMe) return;

    const sapaan = pesanMasuk.toLowerCase().trim();
    let balasan = '';
    let reaction = '';

    const regexSapaan = /^(p+|oi+|hai+|halo+|hallo+|hy+|uy+|hey+|hello+|permisi+|yo+|tes+|woy+|euy+)$/;

    // Deteksi mabar fleksibel
    const isMabar = sapaan.includes("mabar");
    const isMabarFlexible = /maba+r+/i.test(sapaan);

    if (regexSapaan.test(sapaan) || isMabar || isMabarFlexible) {

        // ======================
        // 🔥 Balasan khusus mabar
        // ======================
        if (isMabar || isMabarFlexible) {
            balasan = 'Ayo mabar! Ini ID ML ku: 95384250 😎';
            reaction = '🎮';

            const imagePath = path.join(process.cwd(), "media", "mabar.jpg");

            await sock.sendMessage(from, {
                image: fs.readFileSync(imagePath),
                caption: balasan
            }, { quoted: msg });

            await sock.sendMessage(from, {
                react: {
                    text: reaction,
                    key: msg.key
                }
            });

            return;
        }

        // ======================
        // BALASAN SAPAAN LAIN
        // ======================
        if (/^p+$/.test(sapaan)) {
            balasan = 'Jangan mi p p, Langsung chat saja sayang';
            reaction = '🥰';
        } else if (/^oi+$/.test(sapaan)) {
            balasan = 'oi kenapa ko kah';
            reaction = '👀';
        } else if (/^hai+$/.test(sapaan)) {
            balasan = 'hai juga, ada apa?';
            reaction = '😊';
        } else if (/^(halo+|hallo+)$/.test(sapaan)) {
            balasan = 'halo juga kamu 😄';
            reaction = '👋';
        } else if (/^hy+$/.test(sapaan)) {
            balasan = 'iya hy juga';
            reaction = '🙃';
        } else if (/^uy+$/.test(sapaan)) {
            balasan = 'apa uy?';
            reaction = '🤨';
        } else if (/^hey+$/.test(sapaan)) {
            balasan = 'hey hey, santai aja';
            reaction = '😎';
        } else if (/^hello+$/.test(sapaan)) {
            balasan = 'hello juga 👋';
            reaction = '👋';
        } else if (/^permisi+$/.test(sapaan)) {
            balasan = 'iya, silakan masuk 🙏';
            reaction = '🙏';
        } else if (/^yo+$/.test(sapaan)) {
            balasan = 'yo juga, ada apa bro?';
            reaction = '✌';
        } else if (/^tes+$/.test(sapaan)) {
            balasan = 'tes... 1 2 3, masuk kok 🎤';
            reaction = '🎙';
        } else if (/^woy+$/.test(sapaan)) {
            balasan = 'woy apaan sih 😅';
            reaction = '😅';
        } else if (/^euy+$/.test(sapaan)) {
            balasan = 'euy apaan euy 🤔';
            reaction = '🤔';
        }

        await sock.sendMessage(from, { text: balasan }, { quoted: msg });

        await sock.sendMessage(from, {
            react: {
                text: reaction,
                key: msg.key
            }
        });
    }

    // MULTI PREFIX: ! . / #
    const multiPrefix = ['!', '.', '/', '#'];
    const isCommand = multiPrefix.includes(text[0]);
    const fullArgs = isCommand ? text.slice(1).trim().split(/\s+/) : [];
    const cmd = isCommand ? fullArgs[0].toLowerCase() : '';
    const args = fullArgs.slice(1); // <-- args sebagai array

    const senderName = msg.pushName || "Pengguna";
    const sender = (msg.key.participant || msg.key.remoteJid || "").split('@')[0];
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    // MENU UTAMA
    if (cmd === "menu") {
        await menuCommand({
            sock,
            msg,
            from,
            senderName,
            mentionJid: sender
        });
    }

    if (cmd === "allmenu") {
        const senderName = msg.pushName || "Kamu"; // fallback jika tidak ada nama
        const menuText = allMenu({ senderName });
        await sock.sendMessage(from, {
            react: {
                text: "📜",
                key: msg.key
            }
        });
        await sock.sendMessage(from, {
            text: menuText,
            mentions: [sender],
        }, { quoted: msg });
    }
    if (cmd === "tutorial") {

        return sock.sendMessage(
            from,
            { text: tutorialMenu() },
            { quoted: msg }
        );

    }

    if (/^owner\??$/i.test(cmd)) {
        await ownerCommand({ sock, msg, from });
    }

    if (cmd === "menustiker") {
        return menuStiker({ sock, msg, from });
    }

    // MENU ADMIN
    if (cmd === "adminmenu") {
        const mentionJid = msg.key.participant || msg.key.remoteJid;
        await adminMenuCommand({
            sock,
            msg,
            from,
            mentionJid
        });
    }

    await handleGroupFeatures({
        sock,
        msg,
        cmd,
        args,
        metadata,
        isGroup,
        isAdmin,
        isBotAdmin,
        reply
    });

    // TAG SEMUA
    if (['tagall', 'hidetag'].includes(cmd)) {
        const groupId = msg.key.remoteJid; // ← tambahkan ini sebelum dipanggil
        return await groupTagHandler({ sock, msg, from, cmd, args, groupId });
    }

    if (cmd === "stkr") {
        await stickerFromImage({ sock, msg, from })
    } else if (cmd === "strss") {
        const textSticker = args.join(" ")
        await stickerFromText({ sock, msg, from, text: textSticker })
    } else if (cmd === "stmm") {
        const textMeme = args.join(" ")
        await memeSticker({ sock, msg, from, text: textMeme })
    } else if (cmd === "stnim") {
        await stickerAnimasi({ sock, msg, from })
    } else if (cmd === "rstkr") {
        return stickerReply({ sock, msg, from, text: args.join(" ") })
    }
    if (cmd === "toimg") {
        await toImg({ sock, msg, from })
    }

    // COMMAND AI
    if (cmd === "om") {
        await omCommand({ sock, msg, from, text });
    }

    if (cmd === "gam") {
        await gambarCommand({ sock, msg, from, text });
    }

    if (cmd === "cuaca") {
        await cuacaCommand({ sock, msg, from, text });
    }

    if (cmd === "vid") {
        await vidCommand({ sock, msg, from, text });
    }

    if (cmd === "vids") {
        await vidsCommand({ sock, msg, from, text });
    }


    // Q REPLY MEDIA
    if (cmd === "q") {
        await sendMediaBack({
            sock,
            msg,
            from
        });
    }

    if (cmd === "media") {
        await downloaderCommand({ sock, msg, from, text });
    }

    if (cmd === "play") {
        return await play(sock, msg, from, sender, cmd, args);
    }

    if (cmd === "apk") {
        return await Apk(sock, msg, from, sender, cmd, args);
    }
    
    if (cmd === "!lirik") {
        return Lirik(sock, msg, from, sender, cmd, args);
    }

    // PROFIL & USER
    if (['daftar', 'profil'].includes(cmd)) {
        await userCommands(sock, msg, from, sender, cmd, args);
    }

    if (cmd === "lmclaim") {
        return await claimVidCommand({ sock, msg, from });
    }
    if (cmd === "tflimit") {
        return tflimitCommand({ sock, msg, from, args });
    }
    if (cmd === "addlimit") {
        console.log("COMMAND ADDLIMIT KEPANGGIL");
        return addLimitCommand({ sock, msg, from, args });
    }
    if (cmd === "setlimit") return setLimitCommand({ sock, msg, from, args });
    if (cmd === "remlimit") return remLimitCommand({ sock, msg, from, args });

    // BUCIN
    if (['pacaran', 'putus'].includes(cmd)) {
        await bucinCommands(sock, msg, from, sender, cmd, args);
    }

    const safeText = typeof text === 'string' ? text.toLowerCase() : "";
    if (["aku mau", "yaudah ayo"].includes(safeText)) {
        await bucinCommands(sock, msg, from, sender, "", text);
    }

    // FUN COMMANDS
    await funCommands(sock, msg, from, sender, cmd, args);
    if (cmd === "whoami") {
        return await whoamiCommand(sock, msg, from);
    }
    await jawabWhoamiCommand(sock, msg, from, sender);

    // TEBAK LAGU
    await tebakLagu(sock, msg, from, sender, cmd, args);
    if (cmd === "skiplg") return await skipLagu(sock, msg, from);
    if (cmd === "cluelg") return await clueLagu(sock, msg, from, sender);
    if (cmd === "stoplg") return await stoplg(sock, msg, from, sender, cmd, args);

    // === TEBAK GAMBAR ===
    await tebakGambar(sock, msg, from, sender, cmd, args);
    if (cmd === "skipgm") return await skipGambar(sock, msg, from, sender, cmd);
    if (cmd === "cluegm") return await clueGambar(sock, msg, from, sender, cmd);
    if (cmd === "stopgm") return await stopgm(sock, msg, from, sender, cmd, args);
    if (cmd === "stopsk") return stopSK(sock, msg, from, sender, cmd, args);

    if (cmd === "waifu") {
        // ⏳ reaction loading
        await sock.sendMessage(from, {
            react: {
                text: "⏳",
                key: msg.key
            }
        });

        const img = await getRandomWaifu();

        await sock.sendMessage(from, {
            image: { url: img },
            caption: "Random Waifu 💖"
        }, { quoted: msg });

        // ✅ reaction selesai
        await sock.sendMessage(from, {
            react: {
                text: "✅",
                key: msg.key
            }
        });
    }
    if (cmd === "anime") {
        // ⏳ reaction loading
        await sock.sendMessage(from, {
            react: {
                text: "⏳",
                key: msg.key
            }
        });

        const anime = await getRandomAnime();

        await sock.sendMessage(from, {
            image: { url: anime.image },
            caption:
                `🎬 *${anime.title}*

            ${anime.synopsis || "Sinopsis tidak tersedia"}
            🔗 ${anime.url}`
        }, { quoted: msg });

        // ✅ reaction selesai
        await sock.sendMessage(from, {
            react: {
                text: "✅",
                key: msg.key
            }
        });
    }

}


