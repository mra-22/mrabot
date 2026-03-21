async function sendBotMessage(sock, jid, { image, text, caption, mentions = [] }) {

    const groupConfig = getGroupConfig()

    const allowImage = groupConfig[jid]?.allowImage !== false

    // jika gambar dimatikan
    if (!allowImage && image) {
        return sock.sendMessage(jid, {
            text: caption || text,
            mentions
        })
    }

    // jika gambar diizinkan
    if (image) {
        return sock.sendMessage(jid, {
            image,
            caption,
            mentions
        })
    }

    return sock.sendMessage(jid, {
        text,
        mentions
    })
}