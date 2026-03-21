import fs from "fs";
import sharp from "sharp";

export async function ownerCommand({ sock, msg, from }) {

    const caption = `
🌐 *OWNER*
┃
┃ 👑 *Developer* : 
┃ ➜ Mr.A Dev
┃
┃ 📞 *WhatsApp*  : 
┃ ➜ wa.me/6281344195326
┃
┃ 🧑‍💻 *GitHub*  :
┃ ➜ https://github.com/MrA-22
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

🛠️ *Tentang Owner*
Mr.A Dev adalah developer yang fokus pada otomasi, sistem AI, dan bot multi-fungsi.
Semua proyek dibangun seorang diri, belajar secara otodidak, dan terus berkembang tanpa henti.
> ✨ *Dedikasi • Konsisten • Visioner*

⚙️ *Tentang Bot*
Bot ini dibangun sebagai asisten cerdas yang siap membantu kebutuhan harian:

> • 🔧 Manajemen grup & otomatisasi  
> • 🧰 Tools harian & utilitas praktis  
> • 🎮 Hiburan interaktif  
> • ⚡ Sistem respons cepat 24/7  

Bot ini didesain agar ringan, cepat, stabil, dan mudah digunakan oleh siapa pun.

🚀 *Bagaimana Bot Tercipta?*
Bot ini dirancang sepenuhnya oleh Mr.A Dev, melalui kombinasi:

> • 🧠 AI Engine  
> • 🧩 Script Modular  
> • 🔄 Sistem Otomatis  
> • ⚡ Mekanisme Update Mandiri  

Dibangun tanpa tim, tanpa bantuan eksternal — murni dari perjalanan panjang belajar otodidak.

💬 *Klik link di atas untuk membuka jalur komunikasi.*
`.trim();



    const imgPath = "./bot/owner.png";

    if (!fs.existsSync(imgPath)) {
        return sock.sendMessage(from, { text: "❌ Gambar owner.jpg tidak ditemukan!" });
    }

    // === BLUR GAMBAR ===
    const blurredImage = await sharp(imgPath)
        .blur(2) // nilai blur (1 = tipis, 5 = tebal)
        .jpeg()
        .toBuffer();

    // === KIRIM GAMBAR BESAR + CAPTION DIBAWAHNYA ===
    await sock.sendMessage(
        from,
        {
            image: blurredImage,
            caption
        },
        { quoted: msg }
    );
}
