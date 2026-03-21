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

                    console.log("Bot dihentikan dashboard")

                    process.exit(0)
                }

                if (cmd === "!startbot") {

                    fs.writeFileSync(STATUS_FILE, "RUNNING")

                    continue
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