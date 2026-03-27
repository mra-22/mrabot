import fs from "fs";

export function loadCookie(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf-8");

        const cookies = raw
            .split("\n")
            .filter(line =>
                line &&
                !line.startsWith("#") &&
                line.split("\t").length > 5
            )
            .map(line => {
                const parts = line.split("\t");
                const name = parts[5];
                const value = parts[6];
                return `${name}=${value}`;
            })
            .filter(Boolean);

        return cookies.join("; ");
    } catch (e) {
        console.log("[COOKIE ERROR]", e.message);
        return "";
    }
}
