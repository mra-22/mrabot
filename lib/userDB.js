// lib/userDB.js
import fs from 'fs';
const path = './database/user.json';

export function getAllUserData() {
    try {
        const data = fs.readFileSync(path, 'utf-8');
        return JSON.parse(data || '{}');
    } catch (e) {
        return {};
    }
}

export function setAllUserData(data) {
    try {
        fs.writeFileSync(path, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('❌ Gagal menyimpan userDB:', e);
    }
}
