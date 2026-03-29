from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from datetime import datetime
import qrcode
import base64
from io import BytesIO
import json
import os

# ---------------- LOGGING ----------------
logging.basicConfig(
    filename='api.log',
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s'
)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ---------------- GLOBAL ----------------
qr_data_global = None
LOGS = []

# ---------------- FILES ----------------
COMMAND_QUEUE = "command_queue.txt"
GROUP_FILE = "group_list.json"
PROGRESS_FILE = "broadcast_progress.json"
STATUS_FILE = "bot_status.txt"

# ---------------- HELPERS ----------------
def add_log(msg):
    timestamp = datetime.now().strftime("%H:%M:%S")
    LOGS.insert(0, f"[{timestamp}] {msg}")
    if len(LOGS) > 50:
        LOGS.pop()

def read_json_file(file_path, default):
    if os.path.exists(file_path):
        try:
            with open(file_path) as f:
                return json.load(f)
        except:
            return default
    return default

def write_json_file(file_path, data):
    with open(file_path, "w") as f:
        json.dump(data, f, indent=2)

# ---------------- AFTER REQUEST ----------------
@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    return response

# ---------------- QR ----------------
@app.route("/qr")
def get_qr():
    global qr_data_global
    if not qr_data_global:
        return "❌ QR belum tersedia, bot belum kirim QR"
    try:
        img = qrcode.make(qr_data_global)
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        return f"""
        <h1>Scan QR WhatsApp</h1>
        <img src="data:image/png;base64,{img_base64}" />
        """
    except Exception as e:
        return str(e)

@app.route("/set-qr", methods=["POST"])
def set_qr():
    global qr_data_global
    try:
        if not request.is_json:
            return jsonify({"error": "Request harus JSON"}), 400
        data = request.get_json()
        qr = data.get("qr")
        if not qr:
            return jsonify({"error": "QR kosong"}), 400
        qr_data_global = qr
        add_log("QR updated from Node")
        logging.info("QR updated from Node")
        return jsonify({"status": "QR updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------- COMMAND ----------------
@app.route("/send-command", methods=["POST"])
def send_command():
    try:
        data = request.json
        cmd = data.get("command")
        if not cmd:
            return jsonify({"error": "No command"}), 400
        with open(COMMAND_QUEUE, "a") as f:
            f.write(cmd + "\n")
        add_log(f"Command queued: {cmd}")
        return jsonify({"status": "ok", "command": cmd})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------- STATUS ----------------
@app.route("/status")
def status():
    print("Hit /status")  # <-- ini untuk cek apakah request sampai
    try:
        with open(STATUS_FILE) as f:
            return jsonify({"status": f.read().strip()})
    except Exception as e:
        print("Error membaca status file:", e)
        return jsonify({"status": "STOPPED"})

# ---------------- GROUPS ----------------
@app.route("/groups")
def groups():
    groups_data = read_json_file(GROUP_FILE, [])
    return jsonify(groups_data)

# ---------------- STATS ----------------
@app.route("/stats")
def stats():
    groups_data = read_json_file(GROUP_FILE, [])
    stats_data = {
        "groups": len(groups_data),
        "users": sum(g.get("size", 0) for g in groups_data)
    }
    return jsonify(stats_data)

# ---------------- PROGRESS ----------------
@app.route("/progress")
def progress():
    progress_data = read_json_file(PROGRESS_FILE, {"total":0,"sent":0,"failed":0})
    return jsonify(progress_data)

# ---------------- LOGS ----------------
@app.route("/logs")
def get_logs():
    return jsonify(LOGS)

# ---------------- RUN ----------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
