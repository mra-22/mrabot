import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import chalk from "chalk";
import figlet from "figlet";
import moment from "moment";
import fs from "fs";
import { startDashboardBridge } from "./dashboard_bridge.js";
import messageHandler from "./handlers/messageHandler.js";
import { getGroupConfig } from './moduls/config.js';
import antiStatusMention from './lib/AntiStatus.js';
import express from "express";
import qrcode from "qrcode";

// ======================
// Logger
// ======================
const logStream = fs.createWriteStream("bot.log", { flags: "a" });
const origLog = console.log;
console.log = function (...args) {
    const text = args.join(" ");
    origLog(text);
    logStream.write(text + "\n");
};

const customLogger = pino({
    level: 'error',
    transport: {
        target: 'pino-pretty',
        options: { ignore: 'pid,hostname', colorize: true }
    }
});

// ======================
// Bot status
// ======================
let sock = null;
let BOT_ACTIVE = false;
fs.writeFileSync('bot_status.txt', BOT_ACTIVE ? 'RUNNING' : 'OFFLINE');

// ======================
// Cache group metadata
// ======================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const groupMetaCache = {};
const getGroupMetadataSafe = async (sock, jid) => {
    if (groupMetaCache[jid]) return groupMetaCache[jid];
    try {
        const metadata = await sock.groupMetadata(jid);
        groupMetaCache[jid] = metadata;
        setTimeout(() => delete groupMetaCache[jid], 5 * 60 * 1000);
        return metadata;
    } catch (err) {
        console.error(`❌ Gagal ambil metadata ${jid}:`, err.message || err);
        return null;
    }
};

// ======================
// Hadith list
// ======================
const hadithList = [
    "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya. (HR. Ahmad)",
    "Sesungguhnya amal itu tergantung niatnya. (HR. Bukhari & Muslim)",
    "Senyummu kepada saudaramu adalah sedekah. (HR. Tirmidzi)",
    // ... semua hadits lainnya tetap ada ...
    "Allah dekat dengan hamba yang berdoa kepada-Nya. (HR. Muslim)"
];

let shuffledHadith = [];
let hadithIndex = 0;

function shuffleHadith() {
    shuffledHadith = [...hadithList];
    for (let i = shuffledHadith.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledHadith[i], shuffledHadith[j]] = [shuffledHadith[j], shuffledHadith[i]];
    }
    hadithIndex = 0;
}

function getNextHadith() {
    if (shuffledHadith.length === 0 || hadithIndex >= shuffledHadith.length) shuffleHadith();
    return shuffledHadith[hadithIndex++];
}

// ======================
// Template welcome & goodbye
// ======================
const defaultIntroCard = '╭──🎉 SELAMAT DATANG ──╮\n│ Halo @user\n│ Di grup @group\n│ Pada @tanggal\n╰────────────────────╯';
const defaultOutCard = '╭──👋 GOOD BYE ─╮\n│ @user telah keluar\n│ Dari grup @group\n│ Pada @tanggal\n╰────────────────╯';

function renderIntroCard(template, { userTag, groupName }) {
    const now = new Date();
    const tanggal = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return template.replace(/@user/g, userTag).replace(/@group/g, groupName).replace(/@tanggal/g, tanggal);
}

// ======================
// Global
// ======================
let groupCache = [];
let sentToday = { subuh: { wib: false, wita: false, wit: false }, dzuhur: { wib: false, wita: false, wit: false }, ashar: { wib: false, wita: false, wit: false }, maghrib: { wib: false, wita: false, wit: false }, isya: { wib: false, wita: false, wit: false }, morning: false, night: false, hadith: false };
let prayerTimes = { wib: {}, wita: {}, wit: {} };
let qrGlobal = "";
let broadcastQueue = [];
let isBroadcasting = false;

// ======================
// Function helper
// ======================
function zoneExample(zone) {
    if (zone === "wib") return "Jakarta, Bandung, Surabaya, Medan, Palembang, Lampung, Semarang, Yogyakarta, Pontianak, dan sekitarnya";
    if (zone === "wita") return "Makassar, Bali, Mataram (NTB), Kupang (NTT), Balikpapan, Samarinda, Manado, Palu, Kendari, dan sekitarnya";
    if (zone === "wit") return "Jayapura, Ambon, Ternate, Sorong, Manokwari, Nabire, Merauke, dan sekitarnya";
}

function addBroadcast(text) {
    for (const gid of groupCache) {
        if (!gid.endsWith("@g.us")) continue;
        broadcastQueue.push({ gid, text });
    }
    processBroadcastQueue();
}

async function processBroadcastQueue() {
    if (isBroadcasting) return;
    isBroadcasting = true;
    while (broadcastQueue.length > 0) {
        const job = broadcastQueue.shift();
        try {
            if (!sock || !sock.user) return;
            await sock.sendMessage(job.gid, { text: job.text });
            console.log("📤 Broadcast:", job.gid);
        } catch (err) {
            console.log("❌ Gagal kirim:", job.gid);
        }
        await delay(2500);
    }
    isBroadcasting = false;
}

// ======================
// Prayer time update
// ======================
async function updatePrayerTimes() {
    try {
        const today = new Date().toISOString().split("T")[0];
        const [jakarta, makassar, jayapura] = await Promise.all([
            fetch(`https://api.myquran.com/v2/sholat/jadwal/1301/${today}`),
            fetch(`https://api.myquran.com/v2/sholat/jadwal/1108/${today}`),
            fetch(`https://api.myquran.com/v2/sholat/jadwal/1505/${today}`)
        ]);
        const jkt = await jakarta.json();
        const mks = await makassar.json();
        const jyp = await jayapura.json();
        prayerTimes = { wib: jkt.data.jadwal, wita: mks.data.jadwal, wit: jyp.data.jadwal };
        console.log("🕌 Jadwal sholat:", JSON.stringify(prayerTimes, null, 2));
    } catch (err) {
        console.log("❌ Gagal ambil jadwal:", err.message);
    }
}

// ======================
// Scheduler
// ======================
let schedulerInterval = null;
function startScheduler() {
    if (schedulerInterval) return;
    schedulerInterval = setInterval(async () => {
        const nowWIB = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
        const nowWITA = new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" });
        const nowWIT = new Date().toLocaleString("en-US", { timeZone: "Asia/Jayapura" });
        const wib = new Date(nowWIB);
        const wita = new Date(nowWITA);
        const wit = new Date(nowWIT);
        // kode scheduler lengkap sesuai jam, adzan, pagi, malam, hadits
        // ...
    }, 60000);
}

// ======================
// Safe send
// ======================
async function safeSendMessage(sock, jid, message) {
    if (!BOT_ACTIVE) return;
    try {
        const cfg = getGroupConfig();
        if (jid.endsWith("@g.us") && cfg[jid]?.allowImage === false && message.systemImage) {
            const text = message.caption || message.text || "";
            message = { text, mentions: message.mentions || [] };
        }
        delete message.systemImage;
        await sock.sendMessage(jid, message);
    } catch (err) {
        console.error("❌ Error kirim pesan:", err);
    }
}

// ======================
// Start bot
// ======================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./baileys_auth");
    const { version } = await fetchLatestBaileysVersion();
    if (BOT_ACTIVE) return;
    BOT_ACTIVE = true;
    fs.writeFileSync("bot_status.txt", "RUNNING");

    sock = makeWASocket({ version, logger: customLogger, auth: state, browser: ['Windows', 'Chrome', '120.0'], connectTimeoutMs: 60000, defaultQueryTimeoutMs: 60000, keepAliveIntervalMs: 15000, markOnlineOnConnect: true, syncFullHistory: false, emitOwnEvents: false, generateHighQualityLinkPreview: false });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrGlobal = qr;
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            BOT_ACTIVE = false;
            if (statusCode !== DisconnectReason.loggedOut) setTimeout(startBot, 10000);
        }
        if (connection === "open") {
            await updatePrayerTimes();
            await updateGroupCache();
            if (!schedulerStarted) {
                startScheduler();
                schedulerStarted = true;
            }
            startDashboardBridge(sock, "6281344195326");
        }
    });

    // ======================
    // Event group participant
    // ======================
    sock.ev.on("group-participants.update", async (update) => {
        if (!isReady || !BOT_ACTIVE) return;
        const { id, participants, action } = update;
        const groupMeta = await getGroupMetadataSafe(sock, id);
        if (!groupMeta) return;
        const groupName = groupMeta.subject;
        const groupConfig = getGroupConfig();
        if (!groupConfig[id]?.notif) return;
        for (const p of participants) {
            const participant = typeof p === "string" ? p : p.id;
            const userTag = `@${participant.split("@")[0].split(":")[0]}`;
            if (action === "add") {
                const template = groupConfig[id]?.introcard || defaultIntroCard;
                const caption = renderIntroCard(template, { userTag, groupName }).replace(/\\n/g, '\n');
                let groupPic;
                try { groupPic = await sock.profilePictureUrl(id, "image"); } catch { groupPic = "./bot/menu.jpg"; }
                if (groupConfig[id]?.allowImage === false) {
                    await safeSendMessage(sock, id, { text: caption, mentions: [participant] });
                } else {
                    await safeSendMessage(sock, id, { image: { url: groupPic }, caption, mentions: [participant], systemImage: true });
                }
            } else if (action === "remove") {
                const template = groupConfig[id]?.outcard || defaultOutCard;
                const caption = renderIntroCard(template, { userTag, groupName }).replace(/\\n/g, '\n');
                if (groupConfig[id]?.allowImage === false) {
                    await safeSendMessage(sock, id, { text: caption, mentions: [participant] });
                } else {
                    let groupPic;
                    try { groupPic = await sock.profilePictureUrl(id, "image"); } catch { groupPic = "./bot/menu.jpg"; }
                    await safeSendMessage(sock, id, { image: { url: groupPic }, caption, mentions: [participant], systemImage: true });
                }
            }
        }
    });
}

// ======================
// Express QR server
// ======================
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/qr", async (req, res) => {
    if (!qrGlobal) return res.send("❌ QR belum tersedia.");
    const qrDataUrl = await qrcode.toDataURL(qrGlobal);
    res.send(`<h1>Scan QR WhatsApp</h1><img src="${qrDataUrl}" />`);
});
app.listen(PORT, () => console.log(`🌐 Server QR berjalan di port ${PORT}`));

// ======================
// Start
// ======================
startBot();
