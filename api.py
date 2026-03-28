from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # CORS aman

# ---------------- SIMULATED DATA ----------------
bot_status = "STOPPED"
stats = {"groups": 5, "users": 123}
groups = [
    {"name": "Group Alpha", "size": 25},
    {"name": "Group Beta", "size": 30},
    {"name": "Group Gamma", "size": 18},
    {"name": "Group Delta", "size": 50},
    {"name": "Group Epsilon", "size": 0}
]
progress = {"total": 100, "sent": 0, "failed": 0}
logs = []

# ---------------- ENDPOINTS ----------------

@app.route("/stats", methods=["GET"])
def get_stats():
    return jsonify(stats)

@app.route("/groups", methods=["GET"])
def get_groups():
    return jsonify(groups)

@app.route("/progress", methods=["GET"])
def get_progress():
    return jsonify(progress)

@app.route("/status", methods=["GET"])
def get_status():
    return jsonify({"status": bot_status})

@app.route("/send-command", methods=["POST"])
def send_command():
    global bot_status, progress, logs
    data = request.json
    cmd = data.get("command", "")
    logs.insert(0, f"[{datetime.now().strftime('%H:%M:%S')}] Command received: {cmd}")
    logs = logs[:50]  # max 50 logs

    # Simulasi perintah
    if cmd == "!startbot":
        bot_status = "RUNNING"
        logs.insert(0, f"[{datetime.now().strftime('%H:%M:%S')}] Bot started")
    elif cmd == "!stopbot":
        bot_status = "STOPPED"
        logs.insert(0, f"[{datetime.now().strftime('%H:%M:%S')}] Bot stopped")
    elif cmd.startswith("!broadcast|"):
        msg = cmd.split("|", 1)[1] if "|" in cmd else ""
        sent = min(5, progress["total"] - progress["sent"])
        progress["sent"] += sent
        failed = max(0, 1)  # simulasi 1 gagal
        progress["failed"] += failed
        logs.insert(0, f"[{datetime.now().strftime('%H:%M:%S')}] Broadcast: {msg} (Sent: {sent}, Failed: {failed})")

    return jsonify({"ok": True})

@app.route("/logs", methods=["GET"])
def get_logs():
    return jsonify(logs)

# ---------------- RUN ----------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
