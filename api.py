from flask import Flask, request, jsonify
from flask_cors import CORS
import json, os

app = Flask(__name__)
CORS(app)  # ⚡ CORS aman

# Path file dari bot Node.js
STATUS_FILE = "./bot_status.txt"
GROUP_FILE = "./group_list.json"
STATS_FILE = "./bot_stats.json"
LOG_FILE = "./bot.log"

# ------------------- STATUS BOT -------------------
@app.route("/status", methods=["GET"])
def get_status():
    try:
        with open(STATUS_FILE, "r") as f:
            status = f.read().strip()
        return jsonify({"status": status})
    except Exception as e:
        return jsonify({"status": "UNKNOWN", "error": str(e)})

# ------------------- LIST GROUP -------------------
@app.route("/groups", methods=["GET"])
def get_groups():
    try:
        if os.path.exists(GROUP_FILE):
            with open(GROUP_FILE, "r") as f:
                groups = json.load(f)
            return jsonify(groups)
        else:
            return jsonify([])
    except Exception as e:
        return jsonify({"groups": [], "error": str(e)})

# ------------------- STATS BOT -------------------
@app.route("/stats", methods=["GET"])
def get_stats():
    try:
        if os.path.exists(STATS_FILE):
            with open(STATS_FILE, "r") as f:
                stats = json.load(f)
            return jsonify(stats)
        else:
            return jsonify({"groups": 0, "users": 0})
    except Exception as e:
        return jsonify({"groups": 0, "users": 0, "error": str(e)})

# ------------------- SEND COMMAND -------------------
@app.route("/send-command", methods=["POST"])
def send_command():
    data = request.json
    cmd = data.get("command")
    
    # Simpan command ke file sementara agar Node.js bisa ambil
    CMD_FILE = "./command_queue.json"
    try:
        queue = []
        if os.path.exists(CMD_FILE):
            with open(CMD_FILE, "r") as f:
                queue = json.load(f)
        queue.append(cmd)
        with open(CMD_FILE, "w") as f:
            json.dump(queue, f, indent=2)
        return jsonify({"status": "ok", "command": cmd})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})

# ------------------- GET LOG -------------------
@app.route("/logs", methods=["GET"])
def get_logs():
    try:
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, "r") as f:
                lines = f.readlines()[-100:]  # ambil 100 baris terakhir
            return "<br>".join([line.replace('\n', '') for line in lines])
        else:
            return "Log file belum ada"
    except Exception as e:
        return f"Error: {str(e)}"

# ------------------- ROOT -------------------
@app.route("/", methods=["GET"])
def root():
    return "✅ MR.A BOT API RUNNING 🚀"

@app.route("/progress", methods=["GET"])
def get_progress():
    return jsonify({
        "total": 100,
        "sent": 25,
        "failed": 5
    })
# ------------------- RUN SERVER -------------------
if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=PORT)
