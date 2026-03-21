import fs from 'fs';

const configPath = './database/groupconfig.json';
const warnsPath = './database/warns.json';

function loadJSON(filePath) {
    return fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath))
        : {};
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Data utama
let groupConfig = loadJSON(configPath);
let warns = loadJSON(warnsPath);

// Getter terbaru (agar selalu fresh jika diperlukan)
function getGroupConfig() {
    return loadJSON(configPath);
}

function getWarns() {
    return loadJSON(warnsPath);
}

// Save
function saveGroupConfig(data = groupConfig) {
    saveJSON(configPath, data);
}

function saveWarnsConfig(data = warns) {
    saveJSON(warnsPath, data);
}

export {
    groupConfig,
    warns,
    getGroupConfig,
    getWarns,
    saveGroupConfig,
    saveWarnsConfig
};
