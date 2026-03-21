import { getAllUserData, setAllUserData } from '../lib/userDB.js';
import fs from 'fs';
import fetch from 'node-fetch';

function extractSenderId(msg) {
    try {
        const fromGroup = msg?.key?.remoteJid?.endsWith('@g.us');
        const rawId = fromGroup ? (msg?.key?.participant || msg?.participant) : msg?.key?.remoteJid;
        return rawId || null;
    } catch {
        return null;
    }
}

function resolveToMainId(rawId) {
    const userDB = getAllUserData();
    const cleanId = rawId.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
    return userDB[cleanId] ? cleanId : null;
}

function registerOrUpdateUser(msg) {
    const userDB = getAllUserData();
    const rawId = msg.key.participant || msg.key.remoteJid;
    const pushName = msg.pushName || 'Unknown';

    // Gunakan rawId bersih sebagai key
    const cleanId = rawId.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');

    // Jika sudah terdaftar, return cleanId
    if (userDB[cleanId]) return cleanId;

    // Jika belum, buat entry baru
    userDB[cleanId] = {
        pushName,
        ids: [rawId],
    };

    setAllUserData(userDB);
    return cleanId;
}

const OWNER = [
    "6281344195326",   // nomor asli
    "98321163149341"   // id dari bot
];

function cleanNumber(id) {
    return id
        ?.replace(/@s\.whatsapp\.net$/, '')
        ?.replace(/@lid$/, '')
        ?.replace(/[^0-9]/g, '');
}

function isOwner(rawId) {
    const clean = cleanNumber(rawId);
    console.log("OWNER CHECK:", clean);
    return OWNER.includes(clean);
}

function normalizeJid(id) {
    if (!id) return null;

    // kalau sudah jid valid, balikin
    if (id.endsWith("@s.whatsapp.net")) return id;
    if (id.endsWith("@lid")) return id;

    // kalau nomor biasa
    return id.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
}
function toKey(id) {
    return id
        .replace(/@s\.whatsapp\.net$/, '')
        .replace(/@lid$/, '')
        .replace(/@lid@s\.whatsapp\.net$/, '')
        .trim();
}

function getTargetAndAmount(msg, args) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = contextInfo?.mentionedJid?.[0];

    if (!mentioned) return { error: "mention" };

    const targetKey = resolveToMainId(mentioned);
    if (!targetKey) return { error: "notfound" };

    const numberArg = args.find(a => /^\d+$/.test(a));
    const amount = parseInt(numberArg);

    if (!amount || amount <= 0) return { error: "amount" };

    return { targetKey, amount, mentioned };
}
export const userCommands = async (sock, msg, from, _, cmd, args) => {
    const userKey = registerOrUpdateUser(msg);
    if (!userKey) {
        return sock.sendMessage(from, {
            text: `⚠️ Gagal membaca ID pengguna. Coba lagi atau kirim dari akun WhatsApp biasa.`,
        }, { quoted: msg });
    }

    const userDB = getAllUserData();

    if (cmd === "daftar") {
        if (userDB[userKey]?.umur) {
            return sock.sendMessage(from, {
                text: `╭──❗ *SUDAH TERDAFTAR* ──⬣
│ 🚫 Kamu sudah memiliki akun!
│ 📎 Gunakan *!profil* untuk melihat data.
╰⬣`
            }, { quoted: msg });
        }

        const [name, umur] = args.join(" ").split("|").map(v => v.trim());
        if (!name || !umur || isNaN(umur)) {
            return sock.sendMessage(from, {
                text: `╭──⚠️ *FORMAT SALAH* ──⬣
│ ❌ Contoh:
│ 👉 *!daftar Arif | 20*
╰⬣`
            }, { quoted: msg });
        }

        userDB[userKey] = {
            ...userDB[userKey],
            name,
            umur: Number(umur),
            saldo: userDB[userKey]?.saldo || 500000,
            pasangan: userDB[userKey]?.pasangan || "",
            tanggalJadian: userDB[userKey]?.tanggalJadian || "",
            xp: userDB[userKey]?.xp || 0,
            Vidlimit: userDB[userKey]?.Vidlimit || 0,
            lastClaim: userDB[userKey]?.lastClaim || null
        };
        setAllUserData(userDB);

        return sock.sendMessage(from, {
            text: `╭──✅ *PENDAFTARAN BERHASIL* ─⬣
│ 🎉 Selamat datang *${name}*!
│ 💰 Bonus saldo: *Rp 500.000*
│ 🔍 Ketik *!profil* untuk melihat profilmu.
╰⬣`
        }, { quoted: msg });
    }

    if (cmd === "profil") {
        let targetId = userKey;

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

        if (contextInfo?.participant) targetId = contextInfo.participant;
        else if (contextInfo?.mentionedJid?.length) targetId = contextInfo.mentionedJid[0];
        else {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
            const mentionMatch = text.match(/@(\d{5,16})/);

            if (mentionMatch) {
                targetId = mentionMatch[1] + "@s.whatsapp.net";
            }
        }
        // Pastikan format JID WhatsApp
        targetId = normalizeJid(targetId);

        const targetKey = toKey(targetId);
        const data = userDB[targetKey];
        if (!data) {
            return sock.sendMessage(from, {
                text: `╭──❗ *BELUM DAFTAR* ──⬣
│ 🚫 Kamu belum memiliki akun!
│ 👉 gunakan *!daftar Arif | 20*
╰⬣`
            }, { quoted: msg });
        }

        if (!data || !data.umur) {
            return sock.sendMessage(from, {
                text: `⚠️ Data user tidak ditemukan.`
            }, { quoted: msg });
        }

        // Variabel ppBuffer di luar try/catch
        let ppBuffer;

        try {
            // Debug: tampilkan targetId
            console.log("Fetching profile for:", targetId);

            const ppUrl = await sock.profilePictureUrl(targetId, "image");
            console.log("Profile URL:", ppUrl);

            const res = await fetch(ppUrl);
            ppBuffer = Buffer.from(await res.arrayBuffer());

            if (!ppBuffer || ppBuffer.length === 0) throw new Error("Profile buffer kosong");

        } catch (err) {
            console.log("Gagal ambil foto profil:", err.message);
            ppBuffer = fs.readFileSync("./bot/menu.jpg"); // fallback
        }

        const profileText = `
╭──🪪 *PROFIL PENGGUNA* ──⬣
│ 👤 Nama        : *${data.name || data.pushName}*
│ 🎂 Umur        : *${data.umur || "-"}*
│ 💰 Saldo       : *Rp ${data.saldo || 0}*
│ ⭐ XP          : *${data.xp || 0}*
│ 📩 Limit Video : *${data.Vidlimit || 0}*
│ 💘 Pasangan    : *${data.pasangan || "Belum ada"}*
│ 📅 Jadian      : *${data.tanggalJadian || "Belum ada"}*
╰⬣`;

        return sock.sendMessage(from, {
            image: ppBuffer,
            caption: profileText
        }, { quoted: msg });
    }
};

export async function claimVidCommand({ sock, msg, from }) {
    const rawId = extractSenderId(msg);
    const userKey = resolveToMainId(rawId);
    const userDB = getAllUserData();
    const user = userDB[userKey];

    if (!user) {
        return sock.sendMessage(from, {
            text: `╭──🚫 *BELUM DAFTAR* ──⬣
│ 🚫 Kamu belum terdaftar.
│ ✅ silahkan *daftar* dengan
│  *!daftar Nama | Umur!
╰⬣`,
        }, { quoted: msg });
    }

    const today = new Date().toISOString().split('T')[0];
    if (user.lastVidClaim === today) {
        return sock.sendMessage(from, {
            text: `╭─📛 *SUDAH KLAIM* ─⬣
│ 🕒 Kamu sudah klaim limit video hari ini.
│ 🔁 Klaim lagi besok.
╰⬣`
        }, { quoted: msg });
    }

    user.Vidlimit = (user.Vidlimit || 0) + 10;
    user.lastVidClaim = today;
    userDB[userKey] = user;
    setAllUserData(userDB);

    return sock.sendMessage(from, {
        text: `╭─✅ *KLAIM BERHASIL* ─⬣
│ 🎁 Kamu dapat 10 limit video.
│ 📦 Sisa limitmu: *${user.Vidlimit}*
╰⬣`
    }, { quoted: msg });
}

export async function tflimitCommand({ sock, msg, from, args }) {
    const rawId = extractSenderId(msg);
    const userKey = resolveToMainId(rawId);
    const userDB = getAllUserData();
    const sender = userDB[userKey];

    if (!sender) {
        return sock.sendMessage(from, {
            text: `╭──🚫 *BELUM DAFTAR* ──⬣
│ 🚫 Kamu belum terdaftar.
│ ✅ silahkan *daftar* dengan
│ 👉 *!daftar Nama | Umur*
╰⬣`,
        }, { quoted: msg });
    }

    // Ambil target dari mention
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = contextInfo?.mentionedJid?.[0];

    if (!mentioned) {
        return sock.sendMessage(from, {
            text: `╭──⚠️ *FORMAT SALAH* ──⬣
│ ❌ Contoh:
│ 👉 *!tflimit @user 5*
╰⬣`
        }, { quoted: msg });
    }

    const targetKey = resolveToMainId(mentioned);

    if (!targetKey) {
        return sock.sendMessage(from, {
            text: `⚠️ User target belum pernah terdeteksi oleh bot.\n📩 Suruh dia kirim pesan dulu ke bot.`
        }, { quoted: msg });
    }

    const target = userDB[targetKey];

    if (!target || !target.umur) {
        return sock.sendMessage(from, {
            text: `⚠️ User target belum terdaftar.`
        }, { quoted: msg });
    }

    // Tidak bisa kirim ke diri sendiri
    if (targetKey === userKey) {
        return sock.sendMessage(from, {
            text: `⚠️ Tidak bisa transfer ke diri sendiri.`
        }, { quoted: msg });
    }

    // Ambil jumlah limit
    const numberArg = args.find(a => /^\d+$/.test(a));
    const amount = parseInt(numberArg);

    if (!amount || amount <= 0) {
        return sock.sendMessage(from, {
            text: `⚠️ Masukkan jumlah limit yang valid.\nContoh: !tflimit @user 5`
        }, { quoted: msg });
    }
    if (!amount || amount <= 0) {
        return sock.sendMessage(from, {
            text: `⚠️ Masukkan jumlah limit yang valid.`
        }, { quoted: msg });
    }

    // Cek limit cukup atau tidak
    if ((sender.Vidlimit || 0) < amount) {
        return sock.sendMessage(from, {
            text: `╭──❌ *LIMIT TIDAK CUKUP* ──⬣
│ 📩 Limit kamu: *${sender.Vidlimit || 0}*
╰⬣`
        }, { quoted: msg });
    }

    // Proses transfer
    sender.Vidlimit -= amount;
    target.Vidlimit = (target.Vidlimit || 0) + amount;

    userDB[userKey] = sender;
    userDB[targetKey] = target;
    setAllUserData(userDB);

    return sock.sendMessage(from, {
        text: `╭──💸 *TRANSFER BERHASIL* ──⬣
│ 📤 Dari : *${sender.name || sender.pushName}*
│ 📥 Ke   : *@${targetKey}*
│ 🎁 Jumlah : *${amount} limit*
│ 📦 Sisa limit kamu: *${sender.Vidlimit}*
╰⬣`,
        mentions: [mentioned]
    }, { quoted: msg });
}


export async function addLimitCommand({ sock, msg, from, args }) {
    const rawId = extractSenderId(msg);
    const userKey = resolveToMainId(rawId);
    const userDB = getAllUserData();

    if (!isOwner(rawId)) {
        return sock.sendMessage(from, { text: "❌ Khusus owner." }, { quoted: msg });
    }

    const { targetKey, amount, mentioned, error } = getTargetAndAmount(msg, args);

    if (error === "mention") return sock.sendMessage(from, { text: "❌ Tag user." }, { quoted: msg });
    if (error === "notfound") return sock.sendMessage(from, { text: "❌ User belum chat bot." }, { quoted: msg });
    if (error === "amount") return sock.sendMessage(from, { text: "❌ Jumlah tidak valid." }, { quoted: msg });

    const target = userDB[targetKey];
    target.Vidlimit = (target.Vidlimit || 0) + amount;

    userDB[targetKey] = target;
    setAllUserData(userDB);

    return sock.sendMessage(from, {
        text: `✅ +${amount} limit ke @${targetKey}\n📦 Total: ${target.Vidlimit}`,
        mentions: [mentioned]
    }, { quoted: msg });
}

export async function setLimitCommand({ sock, msg, from, args }) {
    const rawId = extractSenderId(msg);
    const userDB = getAllUserData();

    const userKey = toKey(rawId);

    console.log("OWNER:", userKey);

    // 🔒 hanya owner
    if (!isOwner(rawId)) {
        return sock.sendMessage(from, {
            text: "❌ Khusus owner."
        }, { quoted: msg });
    }

    // 📌 ambil jumlah
    const amount = parseInt(args[0]);

    if (!amount || amount < 0) {
        return sock.sendMessage(from, {
            text: "❌ Masukkan jumlah yang valid.\nContoh: !setlimit 10"
        }, { quoted: msg });
    }

    // ❗ pastikan user ada di DB
    if (!userDB[userKey]) {
        userDB[userKey] = {
            pushName: msg.pushName || "Owner",
            Vidlimit: 0
        };
    }

    // ✅ set limit ke diri sendiri
    userDB[userKey].Vidlimit = amount;

    setAllUserData(userDB);

    console.log("SET LIMIT OWNER:", userKey, amount);

    return sock.sendMessage(from, {
        text: `╭──✅ *SET LIMIT OWNER* ──⬣
│ 👤 Kamu (Owner)
│ 📦 Limit : ${amount}
╰⬣`
    }, { quoted: msg });
}

export async function remLimitCommand({ sock, msg, from, args }) {
    const rawId = extractSenderId(msg);
    const userKey = resolveToMainId(rawId);
    const userDB = getAllUserData();

    if (!isOwner(rawId)) {
        return sock.sendMessage(from, { text: "❌ Khusus owner." }, { quoted: msg });
    }

    const { targetKey, amount, mentioned, error } = getTargetAndAmount(msg, args);

    if (error) {
        return sock.sendMessage(from, { text: "❌ Format salah." }, { quoted: msg });
    }

    const target = userDB[targetKey];
    target.Vidlimit = Math.max(0, (target.Vidlimit || 0) - amount);

    userDB[targetKey] = target;
    setAllUserData(userDB);

    return sock.sendMessage(from, {
        text: `✅ -${amount} limit dari @${targetKey}\n📦 Sisa: ${target.Vidlimit}`,
        mentions: [mentioned]
    }, { quoted: msg });
}