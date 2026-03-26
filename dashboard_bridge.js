import fs from "fs"

const COMMAND_QUEUE = "./command_queue.txt"
const STATUS_FILE = "./bot_status.txt"
const PROGRESS_FILE = "./broadcast_progress.json"

let broadcasting = false
let stopBroadcast = false
let groupCache = null
let lastCacheTime = 0

function delay(ms) {
    return new Promise(r => setTimeout(r, ms))
}

export function startDashboardBridge(sock, ownerNumber) {

    console.log("Dashboard PRO Bridge aktif")

    if (!fs.existsSync(COMMAND_QUEUE)) fs.writeFileSync(COMMAND_QUEUE, "")
    if (!fs.existsSync(STATUS_FILE)) fs.writeFileSync(STATUS_FILE, "RUNNING")

    setInterval(async () => {

        try {

            let commands = []

            try {

                const data = fs.readFileSync(COMMAND_QUEUE, "utf8").trim()

                if (!data) return

                commands = data.split("\n")

                fs.writeFileSync(COMMAND_QUEUE, "")

            } catch {
                return
            }

            for (let cmd of commands) {

                cmd = cmd.trim()
                if (!cmd) continue

                console.log("[DASHBOARD CMD]", cmd)

                // =========================
                // BROADCAST SEMUA GRUP
                // =========================
                if (cmd.startsWith("!broadcast|")) {

                    if (broadcasting) {
                        console.log("Broadcast masih berjalan...")
                        continue
                    }
                    broadcasting = true
                    stopBroadcast = false

                    const message = cmd.split("|")[1]

                    try {

                        // refresh cache tiap 5 menit
                        if (!groupCache || Date.now() - lastCacheTime > 60000) {

                            // refresh cache grup
                            const groups = await sock.groupFetchAllParticipating()

                            groupCache = Object.keys(groups)

                            lastCacheTime = Date.now()

                            console.log("Total grup dari WhatsApp:", groupCache.length)

                        }

                        const groupIds = groupCache

                        if (groupIds.length === 0) {
                            console.log("⚠️ Tidak ada grup ditemukan")
                            broadcasting = false
                            continue
                        }

                        console.log("Total grup:", groupIds.length)

                        let total = groupIds.length
                        let sent = 0

                        for (let gid of groupIds) {

                            if (stopBroadcast) {
                                console.log("⛔ Broadcast dihentikan admin")
                                break
                            }

                            try {

                                await sock.sendMessage(gid, { text: message })

                                sent++

                                console.log(`Broadcast grup ${sent}/${total}`)

                                fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
                                    sent,
                                    total
                                }))

                                await delay(2500)

                            } catch (e) {

                                console.log("Error kirim ke", gid)

                            }

                        }

                        console.log("Broadcast grup selesai")

                    } catch (e) {

                        console.log("Error broadcast:", e)

                    }

                    broadcasting = false
                    stopBroadcast = false

                    continue
                }
                // =========================
                // STOP BROADCAST
                // =========================

                if (cmd === "!stopbroadcast") {

                    if (broadcasting) {
                        stopBroadcast = true
                        console.log("⛔ Stop broadcast diminta admin")
                    } else {
                        console.log("⚠️ Tidak ada broadcast berjalan")
                    }

                    continue
                }
                // =========================
                // BROADCAST GRUP TERTENTU
                // =========================

                if (cmd.startsWith("!broadcastgroup|")) {

                    const parts = cmd.split("|")

                    const gid = parts[1]
                    const message = parts[2]

                    try {

                        await sock.sendMessage(gid, { text: message })

                        console.log("Broadcast ke grup:", gid)

                    } catch {

                        console.log("Gagal kirim ke grup:", gid)

                    }

                    continue
                }

                // =========================
                // BROADCAST SEMUA KONTAK
                // =========================

                if (cmd.startsWith("!broadcastuser|")) {

                    const message = cmd.split("|")[1]

                    const chats = Object.keys(sock.store?.chats || {})

                    let sent = 0

                    for (let id of chats) {

                        if (id.endsWith("@s.whatsapp.net")) {

                            try {

                                await sock.sendMessage(id, { text: message })

                                sent++

                                console.log("Broadcast user:", sent)

                                await delay(2000)

                            } catch { }

                        }

                    }

                    console.log("Broadcast user selesai")

                    continue
                }

                // =========================
                // ADMIN COMMAND
                // =========================

                if (cmd === "!stopbot") {
                    fs.writeFileSync(STATUS_FILE, "STOPPED")
                    console.log("⚠️ Bot dihentikan via dashboard (hanya otomatis dimatikan)")

                    // 1️⃣ Flag 
                    globaglobal.BOT_ACTIVE = false; 
                    broadcasting = false; // hentikan proses broadcast jika ada
                    stopBroadcast = true; // hentikan queue broadcast
                    isBroadcasting = false;
                    broadcastQueue = [];

                    // 2️⃣ Hentikan scheduler interval utama
                    if (schedulerInterval) {
                        clearInterval(schedulerInterval);
                        schedulerInterval = null;
                        console.log("⚠️ Scheduler utama dimatikan")
                    }

                    // 3️⃣ Hentikan interval update group cache (jika ada)
                    if (typeof groupCacheInterval !== "undefined" && groupCacheInterval) {
                        clearInterval(groupCacheInterval);
                        groupCacheInterval = null;
                        console.log("⚠️ Interval update group cache dimatikan")
                    }

                    // 4️⃣ Hentikan interval reset 14 hari
                    if (typeof reset14DayInterval !== "undefined" && reset14DayInterval) {
                        clearInterval(reset14DayInterval);
                        reset14DayInterval = null;
                        console.log("⚠️ Interval reset 14 hari dimatikan")
                    }

                    // 5️⃣ Reset flags supaya semua harian / adzan / hadits dianggap sudah terkirim
                    sentToday = {
                        subuh: { wib: true, wita: true, wit: true },
                        dzuhur: { wib: true, wita: true, wit: true },
                        ashar: { wib: true, wita: true, wit: true },
                        maghrib: { wib: true, wita: true, wit: true },
                        isya: { wib: true, wita: true, wit: true },
                        morning: true,
                        night: true,
                        hadith: true
                    };

                    // 6️⃣ Kosongkan queue broadcast & groupCache supaya tidak ada pesan otomatis
                    broadcastQueue = [];
                    groupCache = [];

                    continue; // jangan exit, lanjut loop command dashboard
                }

                if (cmd === "!startbot") {
                    fs.writeFileSync(STATUS_FILE, "RUNNING")
                    console.log("✅ Bot diaktifkan kembali via dashboard")

                    // 1️⃣ Aktifkan flag global
                    global.BOT_ACTIVE = true;

                    // 2️⃣ Reset sentToday supaya semua scheduler bisa jalan lagi
                    sentToday = {
                        subuh: { wib: false, wita: false, wit: false },
                        dzuhur: { wib: false, wita: false, wit: false },
                        ashar: { wib: false, wita: false, wit: false },
                        maghrib: { wib: false, wita: false, wit: false },
                        isya: { wib: false, wita: false, wit: false },
                        morning: false,
                        night: false,
                        hadith: false
                    };

                    // 3️⃣ Restart scheduler utama
                    if (!schedulerInterval) startScheduler();

                    // 4️⃣ Bisa restart interval lain kalau sebelumnya dimatikan
                    if (!groupCacheInterval) {
                        groupCacheInterval = setInterval(updateGroupCache, 60 * 60 * 1000); // contoh 1 jam
                        console.log("✅ Interval update group cache diaktifkan")
                    }

                    if (!reset14DayInterval) {
                        reset14DayInterval = setInterval(reset14DayFunction, 60 * 1000); // contoh 1 menit cek reset
                        console.log("✅ Interval reset 14 hari diaktifkan")
                    }

                    continue;
                }
                // =========================
                // COMMAND NORMAL
                // =========================

                await sock.sendMessage(
                    ownerNumber + "@s.whatsapp.net",
                    { text: cmd }
                )

            }

        } catch (err) {

            console.log("Bridge error:", err)

        }

    }, 2000)

}
