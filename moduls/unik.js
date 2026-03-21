import sharp from 'sharp'; // pastikan sudah install via: npm install sharp
export async function makeUniqueThumbnail(path) {
    const baseImage = sharp(path).resize(300, 200).jpeg();

    // Tambahkan noise kecil berupa pixel acak (supaya buffer unik)
    const randomPixel = Buffer.from([
        Math.floor(Math.random() * 255), // R
        Math.floor(Math.random() * 255), // G
        Math.floor(Math.random() * 255), // B
        255                              // A (opacity)
    ]);

    const overlay = {
        input: {
            create: {
                width: 1,
                height: 1,
                channels: 4,
                background: { r: randomPixel[0], g: randomPixel[1], b: randomPixel[2], alpha: 1 }
            }
        },
        left: 299, // pojok kanan bawah
        top: 199
    };

    return await baseImage
        .composite([overlay]) // tempel pixel unik
        .toBuffer();
}
