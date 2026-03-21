import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, unlink } from 'fs/promises';

// Ganti dengan API Key kamu dari remove.bg
const REMOVE_BG_API_KEY = '49exuTBvU1TX16uekk856bcB';

export async function removeBackground(imageBuffer) {
    try {
        const tempInputPath = path.join(tmpdir(), `${uuidv4()}.png`);
        const tempOutputPath = path.join(tmpdir(), `${uuidv4()}.png`);

        // Simpan file sementara
        await writeFile(tempInputPath, imageBuffer);

        const formData = new FormData();
        formData.append('image_file', fs.createReadStream(tempInputPath));
        formData.append('size', 'auto');

        const response = await axios({
            method: 'post',
            url: 'https://api.remove.bg/v1.0/removebg',
            data: formData,
            responseType: 'arraybuffer',
            headers: {
                ...formData.getHeaders(),
                'X-Api-Key': REMOVE_BG_API_KEY,
            }
        });

        if (response.status !== 200) {
            throw new Error(`Remove.bg API Error: ${response.status} ${response.statusText}`);
        }

        const resultBuffer = Buffer.from(response.data, 'binary');

        // Hapus file input sementara
        await unlink(tempInputPath);

        return resultBuffer;
    } catch (error) {
        console.error('[REMOVE.BG ERROR]', error.response?.data || error.message);
        throw new Error('Gagal menghapus background gambar.');
    }
}
