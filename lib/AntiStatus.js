// cache pelanggaran
const statusViolations = {}

export default async function antiStatusMention({ sock, msg, groupConfig }) {

    try {

        if (!msg?.message) return

        const from = msg.key.remoteJid
        if (!from.endsWith('@g.us')) return

        if (!groupConfig?.[from]?.antistatus) return

        const sender = msg.key.participant || msg.key.remoteJid
        const keys = Object.keys(msg.message)

        const isStatusMention =
            msg.message?.groupStatusMentionMessage ||
            msg.message?.extendedTextMessage?.contextInfo?.groupStatusMentionMessage

        if (!isStatusMention) return

        // ambil metadata grup
        const metadata = await sock.groupMetadata(from)

        const admins = metadata.participants
            .filter(p => p.admin)
            .map(p => p.id)

        const isAdmin = admins.includes(sender)

        // ADMIN BEBAS
        if (isAdmin) return

        // hapus pesan
        await sock.sendMessage(from, {
            delete: msg.key
        })

        // buat counter
        if (!statusViolations[from]) statusViolations[from] = {}
        if (!statusViolations[from][sender]) statusViolations[from][sender] = 0

        statusViolations[from][sender]++

        const count = statusViolations[from][sender]

        // kick jika >=5
        if (count >= 5) {

            await sock.sendMessage(from, {
                text:
                    `┏━━━〔 🚫 ANTISTATUS SYSTEM 〕━━━⬣
┃
┃ 👤 @${sender.split('@')[0]}
┃
┃ ❌ Pelanggaran tag status
┃ mencapai *${count}x*
┃
┃ ⛔ User dikeluarkan
┃ dari grup
┃
┗━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            })

            await sock.groupParticipantsUpdate(
                from,
                [sender],
                "remove"
            )

            delete statusViolations[from][sender]

            return
        }

        await sock.sendMessage(from, {
            text:
                `┏━━━〔 🚫 ANTI STATUS TAG 〕━━━⬣
┃
┃ ⚠️ Peringatan untuk
┃ 👤 @${sender.split('@')[0]}
┃
┃ Dilarang menandai grup
┃ di status WhatsApp.
┃
┃ 📊 Pelanggaran : *${count}/5*
┃
┃ Jika mencapai 5x
┃ akan dikeluarkan dari grup.
┃
┗━━━━━━━━━━━━━━━━⬣`,
            mentions: [sender]
        })

    } catch (err) {
        console.log("AntiStatus Error:", err)
    }

}