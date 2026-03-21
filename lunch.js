import { spawn } from 'child_process';
import pino from 'pino';
import stripAnsi from 'strip-ansi';

// Logger pino untuk hanya tampilkan level fatal
const customLogger = pino({
    level: 'fatal',
    transport: {
        target: 'pino-pretty',
        options: {
            ignore: 'pid,hostname',
            colorize: true
        }
    }
});

// Fungsi filter log berdasarkan level (hanya tampilkan 'fatal')
function filterLog(data) {
    const lines = stripAnsi(data.toString()).split('\n');
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (parsed.level === 60) { // 60 = 'fatal'
                customLogger.fatal(parsed.msg || parsed.message || parsed);
            }
        } catch {
            // Jika bukan JSON, abaikan
        }
    }
}

// Jalankan bot
function runBot() {
    const bot = spawn('node', ['index.js']);

    bot.stdout.on('data', filterLog);
    bot.stderr.on('data', (data) => {
        console.error('[stderr]', data.toString());
    });

    bot.on('close', (code) => {
        console.log(`[Bot keluar] kode keluar: ${code}`);
        runBot(); // Restart otomatis jika bot keluar
    });
}

runBot();
