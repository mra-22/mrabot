export async function adminMenuCommand({ sock, msg, from, mentionJid }) {
    const senderId = msg.key.participant || msg.key.remoteJid || "";
    const mentionText = `@${senderId.split("@")[0]}`;

    const badwordsList = [
        'anjing', 'kontol', 'babi', 'bangsat', 'tolol', 'goblok',
        'vcs', 'crot', 'full body', 'ngentot', 'memek', 'perek',
        'lonte', 'pepek', 'titit', 'pler', 'coli', 'bokep',
        'jembut', 'bencong', 'gay', 'lesbi', 'ngocok', 'masturbasi',
        'sange', 'sex', 'porno', 'porn', 'nudity', 'nude',
        'bdsm', 'breast', 'boobs', 'pantat', 'pussy', 'desahan',
        'mesum', 'open bo', 'openbo', 'tante',
        'jilboobs', 'toket', 'bugil', 'payudara', 'pijat plus',
        'genitals', 'cabul', 'esek', 'chat sex', 'bispak', 'bisyar',
        'cibai', 'kimak', 'pecun', 'vagina', 'penis', 'asu',
        'mmk', 'kntl', 'ajg', 'anjg', 'bbi', 'pantek', 'pntk', 'sewa',
        'followers'
    ];

    const adminMenuText = `
╭──🛡️ ADMIN MENU ──⬣
│ 👤 Pengguna : ${mentionText}
│ 📅 Tanggal  : ${new Date().toLocaleDateString()}
╰────────────────⭓

╭─⚙️ *MANAJEMEN ADMIN* ─⬣
│ • !admin @user
│ • !unadmin @user
╰────────────────⭓

╭─👥 *ANGGOTA GRUP* ─⬣
│ • !tagall
│ • !hidetag
│ • !infogrup
│ • !linkgrup
│ • !setqc
╰────────────────⭓

╭─🔧 *KONTROL GRUP* ─⬣
│ • !clg | !opg
│ • !antibot
│ • !antistatus on/off
│ • !antilink on/off
│ • !kick
│ • !notif on/off
│ • !del
│ • !invt
│ • !badword on/off
╰────────────────⭓

╭─🚫 *KATA TERLARANG* ─⬣
│ ${badwordsList.map((w, i) => (i + 1) % 5 === 0 ? w + '\n│' : w).join(', ')}
╰────────────────⭓

📌 Gunakan perintah ini dengan bijak.
📍 Hanya Admin yang bisa mengakses.
> © Mr.A Dev – 2025
`.trim();

    // Kirim reaksi 🛡️ ke pesan
    await sock.sendMessage(from, {
        react: {
            text: '🛡️',
            key: msg.key
        }
    });

    // Kirim menu admin
    await sock.sendMessage(from, {
        text: adminMenuText,
        contextInfo: {
            mentionedJid: [mentionJid]
        }
    }, { quoted: msg });
}
