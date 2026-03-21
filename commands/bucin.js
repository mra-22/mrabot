import { getAllUserData, setAllUserData } from "../lib/userDB.js";

const pendingAjakan = {}; // pacaran
const pendingPutus = {};  // putus

export const bucinCommands = async (sock, msg, from, sender, cmd, args) => {
    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    // Jika `args` dikirim (array), gabungkan jadi string
    if (!text && Array.isArray(args)) {
        text = args.join(" ");
    }

    const mentionJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // === AJAK PACARAN ===
    if (cmd === "pacaran") {
        if (!text.toLowerCase().includes("yuk") || mentionJidList.length === 0) {
            return sock.sendMessage(from, {
                text: `
╭──💖 AJAK PACARAN ──⬣
│❗ Gunakan format: *!pacaran yuk @user*
╰⬣
`.trim()
            }, { quoted: msg });
        }

        const pengajak = sender;
        const yangDiajakJid = mentionJidList[0];
        const yangDiajak = yangDiajakJid.split('@')[0];

        const userDB = getAllUserData();
        const pengajakData = userDB[pengajak];
        const diajakData = userDB[yangDiajak];

        if (!pengajakData || !diajakData) {
            return sock.sendMessage(from, {
                text: `
╭──🚫 GAGAL AJAK PACARAN ──⬣
│❌ Pastikan kamu dan @${yangDiajak} sudah daftar.
╰⬣
`.trim(),
                mentions: [yangDiajakJid]
            }, { quoted: msg });
        }

        if (pengajakData.pasangan || diajakData.pasangan) {
            return sock.sendMessage(from, {
                text: `
╭──💢 SUDAH PUNYA PASANGAN ──⬣
│❌ Salah satu sudah punya pasangan.
╰⬣
`.trim(),
                mentions: [yangDiajakJid]
            }, { quoted: msg });
        }

        pendingAjakan[yangDiajak] = { pengajak, from, originalMsg: msg };

        await sock.sendMessage(from, {
            text: `
╭──💌 AJAKAN DITERIMA ──⬣
│📩 Kamu berhasil mengajak @${yangDiajak} pacaran.
╰⬣
`.trim(),
            mentions: [yangDiajakJid]
        }, { quoted: msg });

        await sock.sendMessage(from, {
            text: `
╭──💘 AJAKAN PACARAN ──⬣
│📢 Hai @${yangDiajak}, kamu diajak pacaran oleh @${pengajak}.
│Balas dengan *aku mau* untuk menerima.
╰⬣
`.trim(),
            mentions: [yangDiajakJid, `${pengajak}@s.whatsapp.net`]
        });
    }
    // === AJAK PUTUS ===
    if (cmd === "putus" && text.toLowerCase().includes("yuk") && mentionJidList.length > 0) {
        const pengajak = sender;
        const yangDiajakJid = mentionJidList[0];
        const yangDiajak = yangDiajakJid.split('@')[0];

        const userDB = getAllUserData();
        const pengajakData = userDB[pengajak];
        const diajakData = userDB[yangDiajak];

        if (!pengajakData || !diajakData) {
            return sock.sendMessage(from, {
                text: `
╭──🚫 GAGAL AJAK PUTUS ──⬣
│❌ Pastikan kamu dan @${yangDiajak} sudah daftar.
╰⬣
`.trim(),
                mentions: [yangDiajakJid]
            }, { quoted: msg });
        }

        if (pengajakData.pasangan !== yangDiajak || diajakData.pasangan !== pengajak) {
            return sock.sendMessage(from, {
                text: `
╭──🚫 BUKAN PASANGAN ──⬣
│❌ Kalian bukan pasangan.
╰⬣
`.trim(),
                mentions: [yangDiajakJid]
            }, { quoted: msg });
        }

        pendingPutus[yangDiajak] = { pengajak, from };

        await sock.sendMessage(from, {
            text: `
╭──💔 AJAKAN PUTUS ──⬣
│😞 Kamu meminta @${yangDiajak} untuk putus.
╰⬣
`.trim(),
            mentions: [yangDiajakJid]
        }, { quoted: msg });

        await sock.sendMessage(from, {
            text: `
╭──📢 KONFIRMASI PUTUS ──⬣
│@${yangDiajak}, kamu diajak putus oleh @${pengajak}.
│Balas dengan *aku mau* untuk menyetujui.
╰⬣
`.trim(),
            mentions: [yangDiajakJid, `${pengajak}@s.whatsapp.net`]
        });
    }


    // === RESPON "aku mau"
    if (text.toLowerCase() === "aku mau") {
        const penjawab = sender.split("@")[0]; // Fix: ambil hanya nomornya

        // === Terima ajakan pacaran
        if (pendingAjakan[penjawab]) {
            const { pengajak, from } = pendingAjakan[penjawab];
            const userDB = getAllUserData();

            const pengajakData = userDB[pengajak];
            const diajakData = userDB[penjawab];

            if (!pengajakData || !diajakData) return;

            const now = new Date().toLocaleDateString("id-ID");

            pengajakData.pasangan = penjawab;
            pengajakData.tanggalJadian = now;
            diajakData.pasangan = pengajak;
            diajakData.tanggalJadian = now;

            userDB[pengajak] = pengajakData;
            userDB[penjawab] = diajakData;
            setAllUserData(userDB);

            delete pendingAjakan[penjawab];

            await sock.sendMessage(from, {
                text: `
╭──💝 SELAMAT PACARAN ──⬣
│@${penjawab} dan @${pengajak} sekarang resmi pacaran!
│💑 Jadian: ${now}
╰⬣
`.trim(),
                mentions: [`${penjawab}@s.whatsapp.net`, `${pengajak}@s.whatsapp.net`]
            }, { quoted: msg });
        }

        // === Terima ajakan putus
        else if (pendingPutus[penjawab]) {
            const { pengajak, from } = pendingPutus[penjawab];
            const userDB = getAllUserData();

            const pengajakData = userDB[pengajak];
            const diajakData = userDB[penjawab];

            if (!pengajakData || !diajakData) return;

            pengajakData.pasangan = "";
            pengajakData.tanggalJadian = "";
            diajakData.pasangan = "";
            diajakData.tanggalJadian = "";

            userDB[pengajak] = pengajakData;
            userDB[penjawab] = diajakData;
            setAllUserData(userDB);

            delete pendingPutus[penjawab];

            await sock.sendMessage(from, {
                text: `
╭──💔 PUTUS RESMI ──⬣
│@${penjawab} dan @${pengajak} sudah putus.
│Semangat move on! 🌱
╰⬣
`.trim(),
                mentions: [`${penjawab}@s.whatsapp.net`, `${pengajak}@s.whatsapp.net`]
            }, { quoted: msg });
        }
    }

};
