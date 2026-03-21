import fs from "fs";
import { makeUniqueThumbnail } from "../moduls/unik.js";
import { getGroupConfig } from "../moduls/config.js"; // TAMBAHKAN INI

export async function menuCommand({ sock, msg, from, senderName, mentionJid }) {
        // Tambahkan reaction emoji ke pesan
        await sock.sendMessage(from, {
                react: {
                        text: "📋",
                        key: msg.key
                }
        });
        const tanggal = new Date().toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const waktu = new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit', minute: '2-digit'
        });

        const menuText = `
═══〔 🤖 *MR.A BOT MENU* 〕═══⬣
┃ Halo, *\`${senderName}\`* ! Aku siap bantu 💖
┃
┃ 📆 *Tanggal* : ${tanggal}
┃ ⏰ *Waktu*   : ${waktu}
┃
┃ ✦ Bot WhatsApp
┃ ✦ AI • Tools • Game • Stiker
╰════════════════════⬣

📌 *MENU UTAMA*
┣ 📜 allmenu
┃ ➜ Menampilkan semua fitur bot
┃
┣ 👑 .owner
┃ ➜ Kontak developer bot
╰──────────────⬣

📝 *CATATAN*
┣ 📚 tutorial
┃ ➜ Panduan menggunakan bot
┃
┣ ⚠️ Gunakan bot dengan bijak
┃ ➜ Jangan spam command
╰──────────────⬣

✨ *INFO*
┣ Gunakan *\`allmenu\`* untuk melihat semua fitur
┣ Bot aktif 24 jam selama server online
╰──────────────⬣

☁️ Enjoy the experience
> © MR.A Dev – 2025
`.trim();

        const groupConfig = getGroupConfig()
        const allowImage = groupConfig[from]?.allowImage !== false

        const thumbPath = './bot/menu.jpg'
        let thumbnail = null

        if (allowImage && fs.existsSync(thumbPath)) {
                try {
                        thumbnail = await makeUniqueThumbnail(thumbPath);
                        console.log("✅ Thumbnail menu dibuat unik");
                } catch (err) {
                        console.error("❌ Gagal buat thumbnail unik:", err);
                }
        }

        const message = {
                text: menuText,
                contextInfo: {
                        mentionedJid: [mentionJid]
                }
        }

        if (allowImage && thumbnail) {
                message.contextInfo.externalAdReply = {
                        title: "🤖 MENU UTAMA MR.A",
                        body: "Bot WhatsApp – AI ✦ Game ✦ Tools",
                        thumbnail,
                        mediaType: 1,
                        renderLargerThumbnail: true
                }
        }

        await sock.sendMessage(from, message, { quoted: msg })
}
// MENU LENGKAP (Command: !allmenu)
export function allMenu({ senderName }) {
        return `
╭═══〔 🤖 *MR.A BOT SYSTEM* 〕═══⬣
┣ 🤖 Bot WhatsApp ✦ AI ✦ Game ✦ Tools
┣ Halo, *\`${senderName}\`* 👋
╰════════════════════⬣

📌 *MENU UTAMA*
┣ 📜 !allmenu
┣ 📋 !listmenu
┣ 👑 .owner
┣ 🛠 !adminmenu
╰──────────────⬣

🧠 *AI & TOOLS*
┣ 🤖 .om
┣ 🎨 !gam
┣ 🌦 !cuaca
┣ 💬 .q
╰──────────────⬣

🎨 *STIKER*
┣ 🖼 .stkr
┣ 😵 .strss
┣ 😂 .stmm
┣ ✨ .stnim
┣ 🧹 .rstkr
╰──────────────⬣

📥 *DOWNLOADER*
┣ ⬇️ .media [semua link]
╰──────────────⬣

💘 *BUCIN ZONE*
┣ 💞 !comblang
┣ ❤️ !pacaran yuk 
┣ 💔 !putus yuk 
╰──────────────⬣

🎮 *GAME*
┣ 🎵 !tebaklagu
┣ 🖼️ !tebakgambar
┣ 🔠 !sambungkata
┣ 🎣 !mancing
┣ 🎰 !slot
┣ 💣 !bom
┣ 🧠 !fam100
┣ 🎲 !kocok
┣ 🤔 !truth
┣ 🔥 !dare
┣ ❓ !mister
┣ 😈 !roast
┣ 🔮 !ramal
┣ 🖐️ !tampar
┣ 👊 !pukul
┣ 😘 !cium
┣ 🫂 !peluk
╰──────────────⬣

💰 *SALDO & PROFIL*
┣ 📝 !daftar
┣ 👤 !profil
╰──────────────⬣

🔧 *ADMIN TOOLS*
┣ 🚪 !adminmenu
┃ ➜ Menampilkan Admin Menu
╰──────────────⬣

📚 *PANDUAN*
┣ 📖 !tutorial
╰──────────────⬣

✦ Trust your ideas  
Enjoy the experience ☁️  
> \`© Mr.A Dev – 2025\`
`.trim();
}

export function tutorialMenu() {

        return `
╭═══〔 📚 *TUTORIAL BOT MR.A* 〕═══⬣
┃ Panduan menggunakan fitur bot
╰════════════════════⬣

📌 *MENU UTAMA*
┣ 📜 !allmenu
┃ ➜ Menampilkan semua menu bot
┃
┣ 📋 !listmenu
┃ ➜ Menampilkan menu ringkas
┃
┣ 👑 .owner
┃ ➜ Menghubungi owner bot
╰──────────────⬣

🧠 *AI & TOOLS*
┣ 🤖 .om pertanyaan
┃ ➜ Chat dengan AI
┃
┣ 🎨 !gam deskripsi
┃ ➜ Membuat gambar AI
┃
┣ 🌦 !cuaca kota
┃ ➜ Melihat cuaca kota
┃
┣ 💬 .q
┃ ➜ Membuat quote dari pesan
╰──────────────⬣

🎨 *STIKER*
┣ 🖼 .stkr
┃ ➜ Reply gambar/video jadi stiker
┃
┣ 😵 .strss
┃ ➜ Stiker dengan efek stress
┃
┣ 😂 .stmm teks atas | teks bawah
┃ ➜ Membuat stiker meme
┃
┣ ✨ .stnim
┃ ➜ Membuat stiker animasi
┃
┣ 🧹 .rstkr
┃ ➜ Menganti pack dan autor stiker
╰──────────────⬣

📥 *DOWNLOADER*
┣ ⬇️ .media link
┃ ➜ Download media dari:
┃   YouTube, TikTok, Instagram, dll
┃
┣ 📌 Contoh
┃ ➜ .media https://youtube.com/xxxx
╰──────────────⬣

💘 *BUCIN ZONE*
┣ 💞 !comblang
┃ ➜ Random jodoh di grup
┃
┣ ❤️ !pacaran yuk @user
┃ ➜ Mengajak seseorang pacaran
┃
┣ 💔 !putus yuk @user
┃ ➜ Putus dengan pasangan
╰──────────────⬣

🎮 *GAME*
┣ 🎵 !tebaklagu
┃ ➜ Tebak judul lagu dari audio
┃
┣ 🖼 !tebakgambar
┃ ➜ Tebak gambar yang dikirim bot
┃
┣ 🎵 !sambungkata
┃ ➜ Susun huruf yang tersedia hingga menjadi sebuah kalimat
┃
┣ 🎣 !mancing
┃ ➜ Game memancing ikan
┃
┣ 🎰 !slot
┃ ➜ Game mesin slot
┃
┣ 💣 !bom
┃ ➜ Game bom keberuntungan
┃
┣ 🧠 !fam100
┃ ➜ Game Family 100
┃
┣ 🤔 !truth
┃ ➜ Pertanyaan jujur
┃
┣ 🔥 !dare
┃ ➜ Tantangan lucu
┃
┣ ❓ !Mister
┃ ➜ Jawaban random
┃
┣ 🖐️ !tampar
┃ ➜ minigame untuk menampar
┃
┣ 👊 !pukul
┃ ➜ minigame untuk memukul
┃
┣ 😘 !cium
┃ ➜ minigame untuk mencium
┃
┣ 🫂 !peluk
┃ ➜ minigame untuk memeluk
╰──────────────⬣

💰 *SALDO & PROFIL*
┣ 📝 !daftar Nama | Umur
┃ ➜ Daftar akun di bot
┃
┣ 👤 !profil
┃ ➜ Melihat profil & saldo
╰──────────────⬣

🔧 *ADMIN TOOLS*
┣ 🚪 !kick @user
┃ ➜ Mengeluarkan member
┃
┣ 📣 !tagall
┃ ➜ Tag semua anggota
┃
┣ 👻 !hidetag pesan
┃ ➜ Kirim pesan tanpa terlihat tag
┃
┣ 🔒 !clg
┃ ➜ Menutup grup
┃
┣ 🔓 !opg
┃ ➜ Membuka grup
┃
┣ 🎴 !setintrocard / !setoutcard
┃ ➜ !setintrocard : Mengatur kartu intro member masuk
┃ ➜ !setoutcard   : Mengatur kartu keluar member
┃
┣ 🔔 !notif on/off
┃ ➜ On  : Mengaktifkan notifikasi member masuk/keluar
┃ ➜ Off : Fitur dimatikan
┃
┣ 🖼️ !gruppic on/off
┃ ➜ On  : Bot akan mengirim gambar di grup
┃ ➜ Off : Fitur dimatikan
┃
┣ 🚫 !antistatus on/off
┃ ➜ On  : semua member dapat mentag grup status
┃ ➜ Off : Fitur dimatikan
╰──────────────⬣

✨ *TIPS PENGGUNAAN*
┣ 📌 Reply pesan jika fitur butuh media
┣ 📌 Tag user jika fitur butuh target
┣ 📌 Gunakan link lengkap untuk downloader
╰──────────────⬣

🤖 Selamat menggunakan bot!

Enjoy the experience ☁️  
> © Mr.A Dev – 2025
`.trim();

}
// FUNGSI BANTU – Kotak format
function formatBoxedText(title, lines) {
        const top = `╭── 🃏 ${title} ──⬣`;
        const body = lines.map(line => `│${line}`).join('\n');
        const bottom = '╰⬣';
        return `${top}\n${body}\n${bottom}`;
}

// MENU STIKER KHUSUS (Command: !menu stiker)
export async function menuStiker({ sock, msg, from }) {
        const lines = [
                '    🖼 *.stkr*',
                '   ➠  Balas/kirim gambar → jadi stiker',
                '',
                '   ✏️ *.strss <teks>*',
                '   ➠ Ubah teks jadi stiker besar',
                '',
                '   📝 *.stmm <atas>|<bawah>*',
                '   ➠ Gambar jadi stiker meme teks',
                '   ➠ Bisa pakai emoji 🐶😂🔥',
                '',
                '   🎞 *.stnim*',
                '   ➠ Buat stiker animasi dari video/gif.',
        ];

        const menuText = formatBoxedText('MENU STIKER', lines);

        await sock.sendMessage(from, { text: menuText }, { quoted: msg });

        // 🌀 Tambahkan reaction
        await sock.sendMessage(from, {
                react: {
                        text: "🎨",
                        key: msg.key
                }
        });
}
