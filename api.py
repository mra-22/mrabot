from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import logging
from datetime import datetime
import qrcode
import base64
from io import BytesIO

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

# ---------------- AFTER REQUEST ----------------
@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    return response

# ---------------- FILES ----------------
COMMAND_QUEUE = "command_queue.txt"
STATS_FILE = "bot_stats.json"
GROUP_FILE = "group_list.json"
PROGRESS_FILE = "broadcast_progress.json"
STATUS_FILE = "bot_status.txt"

# ---------------- ROOT ----------------
@app.route("/")
def home():
    return jsonify({"message": "MR.A BOT API RUNNING 🚀"})

# ---------------- QR VIEW ----------------
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

# ---------------- TERIMA QR DARI NODE ----------------
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

        print("✅ QR diterima dari Node")
        logging.info("QR updated from Node")

        return jsonify({"status": "QR updated"})

    except Exception as e:
        print("❌ ERROR /set-qr:", str(e))
        return jsonify({"error": str(e)}), 500
# ---------------- SEND COMMAND ----------------
@app.route("/send-command", methods=["POST"])
def send_command():
    try:
        data = request.json
        cmd = data.get("command")
        if not cmd:
            return jsonify({"error": "No command"}), 400

        with open(COMMAND_QUEUE, "a") as f:
            f.write(cmd + "\n")

        return jsonify({"status": "ok", "command": cmd})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------- STATUS ----------------
@app.route("/status")
def status():
    try:
        with open(STATUS_FILE) as f:
            return jsonify({"status": f.read().strip()})
    except:
        return jsonify({"status": "STOPPED"})

# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 3000)))
