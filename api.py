from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # WAJIB biar Vercel bisa akses

# FILE SYSTEM (sesuai bot kamu)
COMMAND_QUEUE = "command_queue.txt"
STATS_FILE = "bot_stats.json"
GROUP_FILE = "group_list.json"
PROGRESS_FILE = "broadcast_progress.json"
STATUS_FILE = "bot_status.txt"


# ================= COMMAND =================
@app.route("/send-command", methods=["POST"])
def send_command():
    try:
        data = request.json
        cmd = data.get("command")

        if not cmd:
            return jsonify({"error": "No command"}), 400

        # simpan command ke file (dibaca bot kamu)
        with open(COMMAND_QUEUE, "a") as f:
            f.write(cmd + "\n")

        print(f"[{datetime.now()}] COMMAND:", cmd)

        return jsonify({"status": "ok", "cmd": cmd})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ================= STATS =================
@app.route("/stats")
def stats():
    try:
        with open(STATS_FILE) as f:
            return jsonify(json.load(f))
    except:
        return jsonify({"groups": 0, "users": 0})


# ================= GROUPS =================
@app.route("/groups")
def groups():
    try:
        with open(GROUP_FILE) as f:
            return jsonify(json.load(f))
    except:
        return jsonify([])


# ================= PROGRESS =================
@app.route("/progress")
def progress():
    try:
        with open(PROGRESS_FILE) as f:
            return jsonify(json.load(f))
    except:
        return jsonify({"total": 0, "sent": 0})


# ================= STATUS =================
@app.route("/status")
def status():
    try:
        with open(STATUS_FILE) as f:
            return jsonify({"status": f.read().strip()})
    except:
        return jsonify({"status": "STOPPED"})


# ================= TEST ROUTE =================
@app.route("/")
def home():
    return jsonify({
        "message": "MR.A BOT API RUNNING 🚀"
    })


# ================= RUN =================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 3000)))
