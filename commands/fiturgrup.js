import moment from 'moment';
import {
    groupConfig,
    saveGroupConfig,
} from '../moduls/config.js';
import fs from 'fs';;

// Struktur awal
const linkWarnCount = {};
const afkData = {};
const badwords = [
    'anjing', 'kontol', 'babi', 'bangsat', 'tolol', 'goblok',
    'vcs', 'crot', 'full body', 'ngentot', 'memek', 'perek',
    'lonte', 'pepek', 'titit', 'pler', 'coli', 'bokep',
    'jembut', 'bencong', 'gay', 'lesbi', 'ngocok', 'masturbasi',
    'sange', 'sex', 'porno', 'porn', 'nudity', 'nude',
    'bdsm', 'breast', 'boobs', 'pantat', 'pussy', 'desahan',
    'mesum', 'open bo', 'openbo', 'tante',
    'jilboobs', 'toket', 'bugil', 'payudara', 'pijat plus',
    'genitals', 'cabul', 'esek', 'chat sex', 'bispak', 'bisyar',
    'cibai', 'kimak', 'pecun', 'vagina', 'penis', 'asu', 'memek',
    'mmk', 'kntl', 'ajg', 'anjg', 'bbi', 'pantek', 'pntk', 'sewa',
    'followers'
];

const TAG_LIMIT_PATH = './database/taglimit.json';
const TAG_LIMIT_MAX = 5;

function loadTagLimit() {
    if (!fs.existsSync(TAG_LIMIT_PATH)) return {};
    return JSON.parse(fs.readFileSync(TAG_LIMIT_PATH));
}

function saveTagLimit(data) {
    fs.writeFileSync(TAG_LIMIT_PATH, JSON.stringify(data, null, 2));
}

function getTodayKey() {
    const today = new Date();
    return today.toISOString().slice(0, 10); // YYYY-MM-DD
}

const groupMetaCache = {};

const getGroupMetadataSafe = async (sock, jid) => {
    if (groupMetaCache[jid]) return groupMetaCache[jid]; // Gunakan cache jika ada
    try {
        const metadata = await sock.groupMetadata(jid);
        groupMetaCache[jid] = metadata;

        // Cache otomatis hilang setelah 5 menit
        setTimeout(() => {
            delete groupMetaCache[jid];
        }, 5 * 60 * 1000); // 5 menit

        return metadata;
    } catch (err) {
        console.error(`❌ Gagal ambil metadata untuk ${jid}:`, err.message || err);
        return null;
    }
};


function multilineToEscapedNewline(text) {
    return text.replace(/\n/g, '\\n');
}

function escapedNewlineToMultiline(text) {
    return text.replace(/\\n/g, '\n');
}

function formatBox(title, lines = []) {
    const content = lines.map(line => `│ ${line}`).join('\n');
    return `╭─── *${title}* ───⬣\n${content}\n╰─⬣`;
}

function onlyAdmin({ sock, from, msg }) {
    return sock.sendMessage(from, {
        text: formatBox('❌ BUKAN ADMIN', [
            'Perintah ini hanya bisa digunakan oleh admin grup.',
            'Jika kamu admin tapi tidak bisa menggunakan perintah, pastikan bot punya izin.'
        ])
    }, { quoted: msg });
}

function onlyGroup({ sock, from, msg }) {
    return sock.sendMessage(from, {
        text: formatBox('❌ BUKAN ADMIN', [
            'Perintah ini hanya bisa digunakan oleh admin grup.',
            'Jika kamu admin tapi tidak bisa menggunakan perintah, pastikan bot punya izin.'
        ])
    }, { quoted: msg });
}
let qcSchedule = {};
try {
    const file = fs.readFileSync('./database/qc.json');
    qcSchedule = JSON.parse(file);
} catch (e) {
    qcSchedule = {};
}

export async function handleGroupFeatures({
    sock,
    msg,
    cmd,
    args,
    metadata,
    isBotAdmin,
    reply
}) {
    const from = msg.key.remoteJid || msg.key.participant
    const sender = msg.key.participant || msg.key.remoteJid;
    const isAdmin = metadata?.participants?.find(p => p.id === sender)?.admin;
    const isGroup = from.endsWith('@g.us');
    const groupMetadata = metadata;


    if (!groupConfig[from]) {
        groupConfig[from] = {
            antibot: false,
            antilink: false,
            antistatus: false,
            badword: false,
            introcard: '',
            outcrad: '',
            notif: ''
        };
        saveGroupConfig();
    }

    // ╭──💤 MODE AFK ──⬣
    if (['afk'].includes(cmd)) {
        const reason = args.join(' ') || 'Tidak ada alasan';
        afkData[sender] = { time: Date.now(), reason };
        return sock.sendMessage(from, {
            text: formatBox('💤 AFK AKTIF', [
                `Alasan: ${reason}`,
                'Ketik pesan untuk menonaktifkan.'
            ])
        }, { quoted: null });
    }


    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        const user = msg.message.extendedTextMessage.contextInfo.participant;
        if (afkData[user]) {
            const { time, reason } = afkData[user];
            const elapsed = moment.duration(Date.now() - time).humanize();
            return sock.sendMessage(from, {
                text: formatBox('PENGGUNA SEDANG AFK', [
                    `Alasan: ${reason}`,
                    `Sejak: ${elapsed} lalu`
                ])
            }, { quoted: msg });
        }
    }

    if (afkData[sender]) delete afkData[sender];

    // ╭──🤖 ANTIBOT
    if (['antibot'].includes(cmd)) {
        if (!isAdmin) return onlyAdmin({ sock, from, msg });
        if (!isBotAdmin) return sock.sendMessage(from, {
            text: formatBox('❌ GAGAL', ['Bot bukan admin grup.'])
        }, { quoted: msg });

        groupConfig[from].antibot = !groupConfig[from].antibot;
        saveGroupConfig();
        const status = groupConfig[from].antibot ? 'AKTIF ✅' : 'NONAKTIF ❌';
        return sock.sendMessage(from, {
            text: formatBox('🤖 ANTIBOT', [`Status: ${status}`])
        }, { quoted: msg });
    }

    // Fungsi bantu untuk ambil teks dari semua jenis pesan
    const getBody = (msg) => {
        if (msg.message?.conversation) return msg.message.conversation;
        if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
        if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
        if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
        if (msg.message?.documentMessage?.caption) return msg.message.documentMessage.caption;
        return '';
    };

    if (cmd === 'antilink') {
        if (!isGroup) return onlyGroup({ sock, from, msg });
        if (!isAdmin) return onlyAdmin({ sock, from, msg });

        // Inisialisasi grup jika belum ada
        groupConfig[from] = groupConfig[from] || {};

        const option = (args[0] || '').toLowerCase();

        if (option === 'on') {
            groupConfig[from].antilink = true;

            try {
                const inviteCode = await sock.groupInviteCode(from);
                groupConfig[from].inviteCode = inviteCode;
            } catch (err) {
                console.error("❌ Gagal ambil invite code:", err.message);
                groupConfig[from].inviteCode = '';
            }

            saveGroupConfig();
            return sock.sendMessage(from, {
                react: {
                    text: '✅',
                    key: msg.key
                }
            });
        } else if (option === 'off') {
            groupConfig[from].antilink = false;
            delete groupConfig[from].inviteCode;

            saveGroupConfig();
            return sock.sendMessage(from, {
                react: {
                    text: '❌',
                    key: msg.key
                }
            });
        } else if (!option) {
            const status = groupConfig[from].antilink ? 'AKTIF ✅' : 'NONAKTIF ❌';
            return sock.sendMessage(from, {
                text: formatBox('🔗 STATUS ANTILINK', [
                    `Status sekarang: ${status}`,
                    'Fitur akan otomatis hapus link yang tidak diizinkan.'
                ])
            }, { quoted: msg });
        } else {
            return sock.sendMessage(from, {
                text: formatBox('ℹ️ FORMAT SALAH', [
                    'Gunakan:',
                    '!antilink on',
                    '!antilink off',
                    '!antilink      → Cek status'
                ])
            }, { quoted: msg });
        }
    } 

    if (groupConfig[from]?.antilink) {
        const body = getBody(msg).trim().toLowerCase();

        // Lewatkan jika pesan dari bot sendiri
        if (msg.key.fromMe) return;

        // Lewatkan jika command khusus (contoh: .media)
        const allowedPrefixes = ['.media'];
        if (allowedPrefixes.some(prefix => body.startsWith(prefix + ' '))) return;

        const regex = new RegExp(
            [
                /\b(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)?[a-z0-9-]+\.(?:com|id|net|org|info|xyz|me|co|app|shop|site|link|gg|biz|tv|live|store|pro|page|click|blog|agency|studio|social|media|cloud|online|services|today|news|host|wiki|vip|asia)(\/[^\s]*)?/i.source,
                /wa\.me\/\d+/i.source,
                /chat\.whatsapp\.com\/[a-zA-Z0-9]+/i.source,
                /t\.me\/[a-zA-Z0-9]+/i.source,
                /bit\.ly\/[a-zA-Z0-9]+/i.source,
                /linktr\.ee\/[a-zA-Z0-9]+/i.source,
                /instagram\.com\/[a-zA-Z0-9._]+/i.source,
                /facebook\.com\/[a-zA-Z0-9._]+/i.source,
                /youtube\.com\/[a-zA-Z0-9._/?=&-]+/i.source,
                /youtu\.be\/[a-zA-Z0-9._]+/i.source,
                /x\.com\/[a-zA-Z0-9._]+/i.source,
                /twitter\.com\/[a-zA-Z0-9._]+/i.source,
                /telegram\.me\/[a-zA-Z0-9]+/i.source,
                /discord\.gg\/[a-zA-Z0-9]+/i.source,
                /discord\.com\/invite\/[a-zA-Z0-9]+/i.source,
                /tiktok\.com\/[a-zA-Z0-9./?=_-]+/i.source,
                /shopee\.[a-z]+\/[a-zA-Z0-9]+/i.source,
                /tokopedia\.com\/[a-zA-Z0-9._]+/i.source,
                /gojek\.com|grab\.com|ovo\.id|dana\.id|linkaja\.id/i.source
            ].join('|'),
            'gi'
        );

        const found = body.match(regex);

        if (found && found.length > 0) {
            const isIzin = body.includes('izin min');
            if (isIzin) return;

            const ownCode = groupConfig[from]?.inviteCode || '';
            const isGroupLink = found.some(link => ownCode && link.includes(ownCode));

            const senderId = msg.key.participant || msg.key.remoteJid;
            const isFromAdmin = groupMetadata?.participants?.some(p => p.id === senderId && p.admin);

            if (!isGroupLink && !isFromAdmin) {
                // Hapus pesan
                await sock.sendMessage(from, {
                    delete: {
                        remoteJid: from,
                        fromMe: msg.key.fromMe,
                        id: msg.key.id,
                        participant: senderId
                    }
                });

                const key = `${from}_${senderId}`;
                linkWarnCount[key] = (linkWarnCount[key] || 0) + 1;

                const warn = linkWarnCount[key];

                if (warn < 3) {
                    await sock.sendMessage(from, {
                        text: formatBox('⚠️ PELANGGARAN LINK', [
                            `Harap ketik izin min <linkmu>`,
                            `@${senderId.split('@')[0]} mengirim link tanpa izin.`,
                            `❗ Peringatan ke-${warn}/3`,
                            `Jika mengulang 3x, kamu akan dikeluarkan dari grup.`
                        ]),
                        mentions: [senderId]
                    });
                } else {
                    await sock.sendMessage(from, {
                        text: formatBox('⛔ KELUAR DARI GRUP', [
                            `@${senderId.split('@')[0]} dikeluarkan karena 3x mengirim link tanpa izin.`
                        ]),
                        mentions: [senderId]
                    });

                    await sock.groupParticipantsUpdate(from, [senderId], "remove");
                    linkWarnCount[key] = 0; // reset
                }
            }
        }
    }


    // ╭──🗑 DELETE
    if (['delete', 'del'].includes(cmd)) {
        if (!isAdmin) return onlyAdmin({ sock, from, msg });
        const key = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const participant = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (key && participant && isAdmin && isBotAdmin) {
            await sock.sendMessage(from, {
                delete: { remoteJid: from, fromMe: false, id: key, participant }
            });
        }
    }

    // ╭──🔒 clg / opg
    if (['clg', 'opg'].includes(cmd)) {
        if (!isAdmin) return onlyAdmin({ sock, from, msg });

        if (!isBotAdmin) {
            return sock.sendMessage(from, {
                text: formatBox('🤖 BOT BUKAN ADMIN', [
                    'Bot tidak bisa menjalankan perintah ini.',
                    'Pastikan bot sudah dijadikan admin grup.'
                ])
            }, { quoted: msg });
        }
        const setting = cmd === 'clg' ? 'announcement' : 'not_announcement';
        await sock.groupSettingUpdate(from, setting);
        const text = cmd === 'clg'
            ? 'Grup kini hanya admin yang dapat kirim pesan.'
            : 'Grup dibuka untuk semua anggota.';
        return sock.sendMessage(from, {
            text: formatBox('🔧 STATUS GRUP', [text])
        }, { quoted: msg });
    }

    // ╭──📌 ANTISTATUS ──⬣
    if (['antistatus'].includes(cmd)) {

        if (!isAdmin) return onlyAdmin({ sock, from, msg });

        if (!isBotAdmin) return sock.sendMessage(from, {
            text: formatBox('❌ GAGAL', ['Bot bukan admin grup.'])
        }, { quoted: msg });

        groupConfig[from] = groupConfig[from] || {};

        groupConfig[from].antistatus = !groupConfig[from].antistatus;

        saveGroupConfig?.();

        const status = groupConfig[from].antistatus ? 'AKTIF ✅' : 'NONAKTIF ❌';

        return sock.sendMessage(from, {
            text: formatBox('📌 ANTISTATUS', [`Status: ${status}`])
        }, { quoted: msg });

    }
    // ╭──👢 KICK
    if (['kick'].includes(cmd)) {
        if (!isAdmin) return onlyAdmin({ sock, from, msg });

        if (!isBotAdmin) {
            return sock.sendMessage(from, {
                text: formatBox('🤖 BOT BUKAN ADMIN', [
                    'Bot tidak bisa menjalankan perintah ini.',
                    'Pastikan bot sudah dijadikan admin grup.'
                ])
            }, { quoted: msg });
        }

        // Ambil user yang di-tag
        let mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

        // Fallback: jika tidak men-tag, cek apakah reply ke seseorang
        if (!mentioned || mentioned.length === 0) {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quoted) mentioned = [quoted];
        }

        // Jika tetap tidak ada target
        if (!mentioned || mentioned.length === 0) {
            return sock.sendMessage(from, {
                text: formatBox('⚠️ GAGAL KICK', [
                    'Tag atau reply seseorang untuk dikeluarkan.',
                    'Contoh: !kick @user atau reply lalu ketik !kick'
                ])
            }, { quoted: msg });
        }

        // Eksekusi kick
        await sock.groupParticipantsUpdate(from, mentioned, 'remove');
        return sock.sendMessage(from, {
            text: formatBox('👢 KICK', ['Pengguna telah dikeluarkan.'])
        }, { quoted: msg });
    }


    // ╭──🔗 LINKGRUP
    if (['linkgroup', 'linkgrup'].includes(cmd)) {
        const code = await sock.groupInviteCode(from);
        const link = `https://chat.whatsapp.com/${code}`;
        return sock.sendMessage(from, {
            text: formatBox('🔗 LINK GRUP', [
                `🏷️ Nama Grup: ${metadata.subject}`,
                `🔗 Link Grup: ${link}`
            ])
        }, { quoted: msg });
    }

    // ╭──ℹ️ INFOGRUP
    if (['infogroup', 'groupinfo', 'infogrup', 'grupinfo'].includes(cmd)) {
        return sock.sendMessage(from, {
            text: formatBox('ℹ️ INFO GRUP', [
                `🏷️ Nama   : *${metadata.subject}*`,
                `👑 Owner  : @${metadata.owner?.split('@')[0] || 'tidak diketahui'}`,
                `👥 Anggota: *${metadata.participants.length}*`,
                `🆔 ID     : *${from}*`

            ]),
            mentions: [metadata.owner]
        }, { quoted: msg });
    }

    //🔔 NOTIF GRUP
    if (cmd === 'notif') {
        if (!isGroup) return onlyGroup({ sock, from, msg });
        if (!isAdmin) return onlyAdmin({ sock, from, msg });

        // Inisialisasi grup jika belum ada
        groupConfig[from] = groupConfig[from] || {};

        const option = (args[0] || '').toLowerCase();

        if (option === 'on') {
            groupConfig[from].notif = true;
            saveGroupConfig();
            return sock.sendMessage(from, {
                react: {
                    text: '📢',
                    key: msg.key
                }
            });
        } else if (option === 'off') {
            groupConfig[from].notif = false;
            saveGroupConfig();
            return sock.sendMessage(from, {
                react: {
                    text: '🔕',
                    key: msg.key
                }
            });
        } else if (!option) {
            const status = groupConfig[from].notif ? 'AKTIF ✅' : 'NONAKTIF ❌';
            return sock.sendMessage(from, {
                text: formatBox('🔔 FITUR NOTIFIKASI', [
                    `Status sekarang: ${status}`,
                    'Notifikasi welcome/goodbye akan dikirim otomatis.'
                ])
            }, { quoted: msg });
        } else {
            return sock.sendMessage(from, {
                text: formatBox('ℹ️ FORMAT SALAH', [
                    'Gunakan:',
                    '!notif on',
                    '!notif off',
                    '!notif      → Cek status'
                ])
            }, { quoted: msg });
        }
    }

    // ╭──🛡️ ADMIN / UNADMIN
    if (['admin', 'unadmin'].includes(cmd)) {
        if (!isAdmin) return onlyAdmin({ sock, from, msg });

        if (!isBotAdmin) {
            return sock.sendMessage(from, {
                text: formatBox('🤖 BOT BUKAN ADMIN', [
                    'Bot tidak bisa menjalankan perintah ini.',
                    'Pastikan bot sudah dijadikan admin grup.'
                ])
            }, { quoted: msg });
        }
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned) return sock.sendMessage(from, {
            text: formatBox('❗ PERINTAH ADMIN', ['Tag user yang ingin dijadikan admin atau dicabut.'])
        }, { quoted: msg });

        const action = cmd === 'admin' ? 'promote' : 'demote';

        await sock.groupParticipantsUpdate(from, mentioned, action);

        return sock.sendMessage(from, {
            text: formatBox(cmd === 'admin' ? '🛡️ PROMOSI ADMIN' : '⛔ CABUT ADMIN', [
                `Berhasil ${cmd === 'admin' ? 'menjadikan' : 'mencabut'} admin:`,
                ...mentioned.map(jid => `@${jid.split('@')[0]}`)
            ]),
            mentions: mentioned
        }, { quoted: msg });
    }

    // ╭──💬 QUICK CHAT ──⬣
    if (cmd === 'setqc') {
        if (!args.join(" ").includes('|')) {
            return sock.sendMessage(from, {
                text: formatBox('❌ FORMAT SALAH', [
                    'Gunakan format:',
                    '!setqc <jam(HH:MM)>|<judul>|<isi>'
                ])
            }, { quoted: msg });
        }

        const [waktu, judul, ...isiArr] = args.join(" ").split('|');
        const isi = isiArr.join('|');

        qcSchedule[from] = qcSchedule[from] || [];
        qcSchedule[from].push({
            time: waktu.trim(),
            title: judul.trim(),
            content: isi.trim()
        });

        fs.writeFileSync('./database/qc.json', JSON.stringify(qcSchedule, null, 2));
        return sock.sendMessage(from, {
            text: formatBox('✅ QC TERJADWAL', [
                `Jam: ${waktu}`,
                `Judul: ${judul}`,
                `Isi: ${isi}`
            ])
        }, { quoted: msg });
    }

    if (cmd === 'delqc') {
        qcSchedule[from] = [];
        fs.writeFileSync('../database/qc.json', JSON.stringify(qcSchedule, null, 2));
        return sock.sendMessage(from, {
            text: formatBox('✅ QC DIHAPUS', ['Semua jadwal QC dihapus.'])
        }, { quoted: msg });
    }


    // ╭─❏ INVITE
    if (cmd === 'invt') {
        if (!isAdmin) return onlyAdmin({ sock, from, msg });

        if (!isBotAdmin) {
            return sock.sendMessage(from, {
                text: formatBox('🤖 BOT BUKAN ADMIN', [
                    'Bot tidak bisa menjalankan perintah ini.',
                    'Pastikan bot sudah dijadikan admin grup.'
                ])
            }, { quoted: msg });
        }

        // Ambil nomor dari input user
        const inputNumber = args[0];
        if (!inputNumber) {
            return sock.sendMessage(from, {
                text: formatBox('📛 FORMAT SALAH', [
                    'Kirim perintah dengan format: *!invt 08xxxxxx*',
                    'Contoh: !invt 081234567890'
                ])
            }, { quoted: msg });
        }

        const number = inputNumber.replace(/\D/g, '').replace(/^0/, '62'); // bersihkan dan ubah ke 62
        const jid = number + '@s.whatsapp.net';

        try {
            const res = await sock.groupInviteCode(from);
            const link = `https://chat.whatsapp.com/${res}`;

            await sock.sendMessage(jid, {
                text: formatBox('🎟️ UNDANGAN GRUP', [
                    `📌 Grup : *${metadata.subject}*`,
                    `🔗 Link : ${link}`
                ])
            });

            return sock.sendMessage(from, {
                text: formatBox('✅ INVITE BERHASIL', [
                    `📤 Undangan terkirim ke: *${inputNumber}*`
                ])
            }, { quoted: msg });

        } catch (e) {
            console.error('Gagal invite:', e);
            return sock.sendMessage(from, {
                text: formatBox('❌ GAGAL INVITE', [
                    '🚫 Terjadi kesalahan saat mengirim undangan.'
                ])
            }, { quoted: msg });
        }
    }

    // ╭──🚫 TOGGLE BADWORD ON/OFF
    if (cmd === 'badword') {
        if (!isGroup) return onlyGroup({ sock, from, msg });
        if (!isAdmin) return onlyAdmin({ sock, from, msg });
        if (!isBotAdmin) {
            return sock.sendMessage(from, {
                text: formatBox('❌ GAGAL', ['Bot bukan admin grup.'])
            }, { quoted: msg });
        }

        // Inisialisasi grup jika belum ada
        groupConfig[from] = groupConfig[from] || {};

        const sub = args[0]?.toLowerCase();

        if (sub === 'on') {
            groupConfig[from].badword = true;
            await sock.sendMessage(from, {
                react: {
                    text: '🛡️',
                    key: msg.key
                }
            });
        } else if (sub === 'off') {
            groupConfig[from].badword = false;
            await sock.sendMessage(from, {
                react: {
                    text: '🚫',
                    key: msg.key
                }
            });
        } else if (!sub) {
            const status = groupConfig[from].badword ? 'AKTIF ✅' : 'NONAKTIF ❌';
            return sock.sendMessage(from, {
                text: formatBox('🚫 FITUR BADWORD', [
                    `Status sekarang: ${status}`,
                    'Pesan berisi kata kasar akan dihapus otomatis.'
                ])
            }, { quoted: msg });
        } else {
            return sock.sendMessage(from, {
                text: formatBox('📛 BADWORD', [
                    'Gunakan:',
                    '!badword on   → Aktifkan',
                    '!badword off  → Nonaktifkan',
                    '!badword      → Cek status'
                ])
            }, { quoted: msg });
        }

        saveGroupConfig?.();
    }

    // ╭──🚫 CEK BADWORD OTOMATIS
    if (groupConfig[from]?.badword) {

        const botNumber = sock.user.id;

        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const lower = body.trim().toLowerCase();

        const senderId = msg.key.participant || msg.participant || msg.key.remoteJid;
        const isFromBot = msg.key.fromMe || senderId === botNumber;

        if (isFromBot) return;

        const detectedWords = badwords.filter(word => {
            const pattern = new RegExp(`\\b${word}\\b`, 'i');
            return pattern.test(lower);
        });

        if (detectedWords.length > 0) {

            // pastikan storage warning ada
            groupConfig[from].warnings = groupConfig[from].warnings || {};
            groupConfig[from].warnings[senderId] = (groupConfig[from].warnings[senderId] || 0) + 1;

            const warnCount = groupConfig[from].warnings[senderId];

            // Hapus pesan
            await sock.sendMessage(from, {
                delete: {
                    remoteJid: from,
                    fromMe: msg.key.fromMe,
                    id: msg.key.id,
                    participant: senderId
                }
            });

            const badwordList = detectedWords.map(w => `• ${w}`).join('\n');

            // Jika sudah 10x
            if (warnCount >= 10) {

                await sock.groupParticipantsUpdate(
                    from,
                    [senderId],
                    "remove"
                );

                delete groupConfig[from].warnings[senderId];

                return sock.sendMessage(from, {
                    text: formatBox('🚫 USER DIKICK', [
                        `@${senderId.split('@')[0]} telah dikeluarkan.`,
                        '',
                        'Alasan:',
                        'Mengirim badword lebih dari 10x.'
                    ]),
                    mentions: [senderId]
                });
            }

            // Jika masih dibawah 10
            await sock.sendMessage(from, {
                text: formatBox('⚠️ JAGA KETIKAN ANDA', [
                    `@${senderId.split('@')[0]} mengirim kata kasar.`,
                    '',
                    '*Kata terdeteksi:*',
                    badwordList,
                    '',
                    `Peringatan: ${warnCount}/10`,
                    'Jika 10x akan dikeluarkan dari grup.'
                ]),
                mentions: [senderId]
            });
        }
    }

    if (cmd === "gruppic") {

        if (!isGroup) {
            return sock.sendMessage(from, {
                text: "❌ Perintah ini hanya bisa digunakan di grup."
            }, { quoted: msg });
        }

        if (!isAdmin) {
            return sock.sendMessage(from, {
                text: "🚫 Hanya admin grup yang bisa mengubah pengaturan ini."
            }, { quoted: msg });
        }

        groupConfig[from] = groupConfig[from] || {};

        const sub = args[0]?.toLowerCase();

        if (sub === "on") {

            groupConfig[from].allowImage = true;

            await sock.sendMessage(from, {
                text: "🖼️ Semua gambar dari bot di grup ini akan ditampilkan."
            }, { quoted: msg });

        } else if (sub === "off") {

            groupConfig[from].allowImage = false;

            await sock.sendMessage(from, {
                text: "🚫 Semua gambar dari bot dimatikan. Bot hanya akan mengirim teks."
            }, { quoted: msg });

        } else {

            const status = groupConfig[from].allowImage !== false ? "AKTIF ✅" : "NONAKTIF ❌";

            await sock.sendMessage(from, {
                text:
                    `🖼️ *BOT IMAGE CONTROL*

Status: ${status}

Perintah:
!gruppic on
!gruppic off`
            }, { quoted: msg });

        }

        saveGroupConfig?.();
    }


    if (cmd === 'setintrocard') {
        const ownerJid = '98321163149341@lid';
        const senderJid = msg.participant || msg.key.participant || msg.key.remoteJid;


        if (!msg.key.remoteJid.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: formatBox('⛔ GAGAL', [
                    'Command ini hanya bisa digunakan di dalam grup.'
                ])
            }, { quoted: msg });
        }

        // Ambil admin grup
        const groupMeta = await sock.groupMetadata(from);
        const groupAdmins = groupMeta.participants
            .filter(p => p.admin !== null)
            .map(p => p.id);

        const isOwner = senderJid === ownerJid;
        const isAdmin = groupAdmins.includes(senderJid);

        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, {
                text: formatBox('⛔ AKSES DITOLAK', [
                    'Command ini hanya bisa digunakan oleh *Owner Bot* atau *Admin Grup*!'
                ])
            }, { quoted: msg });
        }

        // Input teks
        const textInput = args.join(' ').trim();
        if (!textInput) {
            return sock.sendMessage(from, {
                text: formatBox('📇 SET INTROCARD', [
                    'Format penggunaan:',
                    '!setintrocard [teks intro]',
                    '',
                    'Contoh:',
                    '!setintrocard Selamat datang @user di @group',
                    '',
                    'Multiline (gunakan \\n):',
                    '╭──🎉 SELAMAT DATANG ──╮\\n│ Halo @user\\n│ Di grup @group\\n│ @tanggal\\n╰───────────────────╯'
                ])
            }, { quoted: msg });
        }

        let fullMsg = msg.message.conversation
            || msg.message.extendedTextMessage?.text
            || textInput;

        // Hapus prefix command
        if (fullMsg.toLowerCase().startsWith('!setintrocard')) {
            fullMsg = fullMsg.slice('!setintrocard'.length).trim();
        }

        const formattedText = multilineToEscapedNewline(fullMsg);

        console.log("⏺️ Menyimpan introcard untuk:", from);
        console.log("📦 Value yang disimpan:", formattedText);

        // Simpan ke groupConfig JSON
        groupConfig[from] = groupConfig[from] || {};
        groupConfig[from].introcard = formattedText;
        saveGroupConfig();

        await sock.sendMessage(from, {
            text: formatBox('✅ INTROCARD TERSIMPAN', [
                'Pesan intro berhasil disimpan!',
                '',
                '📎 Placeholder:',
                '- @user   → Tag member baru',
                '- @group  → Nama grup',
                '- @tanggal→ Tanggal sekarang',
                '',
                '📋 Preview:',
                '',
                escapedNewlineToMultiline(formattedText)
            ])
        }, { quoted: msg });
    }

    if (cmd === 'setoutcard') {
        const ownerJid = '6281344195326@s.whatsapp.net';
        const senderJid = msg.key.participant || msg.key.remoteJid;

        console.log('Sender:', senderJid);

        if (!msg.key.remoteJid.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: formatBox('⛔ GAGAL', [
                    'Command ini hanya bisa digunakan di dalam grup.'
                ])
            }, { quoted: msg });
        }

        // Ambil admin grup
        const groupMeta = await sock.groupMetadata(from);
        const groupAdmins = groupMeta.participants
            .filter(p => p.admin !== null)
            .map(p => p.id);

        const isOwner = senderJid === ownerJid;
        const isAdmin = groupAdmins.includes(senderJid);

        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, {
                text: formatBox('⛔ AKSES DITOLAK', [
                    'Command ini hanya bisa digunakan oleh *Owner Bot* atau *Admin Grup*!'
                ])
            }, { quoted: msg });
        }

        const textInput = args.join(' ').trim();
        if (!textInput) {
            return sock.sendMessage(from, {
                text: formatBox('📇 SET OUTCARD', [
                    'Format penggunaan:',
                    '!setoutcard [teks out]',
                    '',
                    'Contoh:',
                    '!setoutcard Selamat tinggal @user dari @group',
                    '',
                    'Multiline (gunakan \\n):',
                    '╭──👋 SELAMAT TINGGAL ──╮\\n│ Bye @user\\n│ Dari grup @group\\n│ @tanggal\\n╰────────────────────╯'
                ])
            }, { quoted: msg });
        }

        let fullMsg = msg.message.conversation || msg.message.extendedTextMessage?.text || textInput;
        if (fullMsg.toLowerCase().startsWith('!setoutcard')) {
            fullMsg = fullMsg.slice('!setoutcard'.length).trim();
        }

        const formattedText = multilineToEscapedNewline(fullMsg);

        console.log("⏺️ Menyimpan outcard untuk:", from);
        console.log("📦 Value yang disimpan:", formattedText);

        if (!msg.key.remoteJid.endsWith('@g.us')) {
            return sock.sendMessage(from, {
                text: formatBox('⛔ GAGAL', [
                    'Command ini hanya bisa digunakan di dalam grup.'
                ])
            }, { quoted: msg });
        }

        groupConfig[from] = groupConfig[from] || {};
        groupConfig[from].outcard = formattedText;

        saveGroupConfig();

        await sock.sendMessage(from, {
            text: formatBox('✅ OUTCARD TERSIMPAN', [
                'Pesan keluar grup berhasil disimpan!',
                '',
                'Placeholder aktif:',
                ' @user   → Tag member keluar',
                ' @group  → Nama grup',
                ' @tanggal→ Tanggal sekarang',
                '',
                '📎 Preview:',
                '',
                escapedNewlineToMultiline(formattedText),
                ''
            ])
        }, { quoted: msg });
    }
}

export async function groupTagHandler({ sock, msg, from, cmd, args, groupId }) {
    if (!msg.key.remoteJid.endsWith('@g.us')) {
        return sock.sendMessage(from, {
            text: `╭──🚫 *AKSES DITOLAK* ──⬣\n│ Perintah ini hanya untuk *Grup WhatsApp*\n╰⬣`
        }, { quoted: msg });
    }

    const metadata = await getGroupMetadataSafe(sock, groupId);
    if (!metadata) {
        return sock.sendMessage(from, {
            text: `❌ Gagal mengambil metadata grup.`,
        }, { quoted: msg });
    }

    const participants = metadata.participants || [];
    const senderName = msg.pushName || 'User';
    const senderId = (msg.key.participant || msg.participant || msg.key.remoteJid)?.replace(/:[0-9]+/g, '');
    const customMsg = args.join(' ');
    const admins = participants.filter(p => p.admin).map(p => p.id);

    if (!admins.includes(senderId)) {
        return sock.sendMessage(from, {
            text: `╭──🚫 *AKSES DITOLAK* ──⬣\n│ Perintah ini hanya untuk *Admin Grup*\n╰⬣`,
        }, { quoted: msg });
    }

    const todayKey = getTodayKey();
    const tagLimitData = loadTagLimit();
    const userKey = `${groupId}|${senderId}|${todayKey}`;

    const currentUsage = tagLimitData[userKey] || 0;
    if (currentUsage >= TAG_LIMIT_MAX) {
        return sock.sendMessage(from, {
            text: `❌ *Batas penggunaan tercapai!*\nAnda sudah menggunakan perintah *${TAG_LIMIT_MAX}x hari ini*. Coba lagi besok.`,
        }, { quoted: msg });
    }

    const mentions = participants.map(p => p.id);
    const mentionList = participants
        .map((p, i) => `┃ ${i + 1}. @${p.id.split('@')[0]}`)
        .join('\n');

    if (cmd === "tagall") {
        const text = `╭──👥 TAG SEMUA MEMBER ──⬣
│ 👤 Dari : *${senderName}*
│ 📛 Penggunaan Hari Ini : *${currentUsage + 1}/${TAG_LIMIT_MAX}x*
╰─────────────⭓
${customMsg ? `💬 Pesan: ${customMsg}\n` : ''}${mentionList}`;

        await sock.sendMessage(from, {
            text,
            mentions
        }, { quoted: msg });
    }

    if (cmd === "hidetag") {
        const text = `╭──🤫 HIDE TAG ──⬣
│ 📛 Penggunaan Hari Ini : *${currentUsage + 1}/${TAG_LIMIT_MAX}x*
${customMsg ? `│ 💬 Pesan : ${customMsg}\n` : ''}╰─────────────⭓`;

        await sock.sendMessage(from, {
            text,
            mentions
        },);
    }
    // Simpan penggunaan
    tagLimitData[userKey] = currentUsage + 1;
    saveTagLimit(tagLimitData);
}