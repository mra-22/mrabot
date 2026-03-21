import fs from 'fs';

// Mendapatkan ID mentah dari msg (tidak dibersihkan)
export function getSenderRawId(msg) {
    return msg.key.participant || msg.key.remoteJid || '';
}

// Fungsi untuk mendapatkan key utama user dari userDB berdasarkan id
export function resolveToMainId(rawId) {
    const userDB = JSON.parse(fs.readFileSync('./database/user.json', 'utf-8'));
    rawId = rawId.replace(/:.*/g, ''); // hilangkan :number (khusus untuk grup WA multi-device)

    for (const [key, user] of Object.entries(userDB)) {
        if (user.ids && Array.isArray(user.ids) && user.ids.includes(rawId)) {
            return key;
        }
        // fallback: kalau key-nya sendiri adalah ID
        if (key === rawId) return key;
    }

    return null;
}
