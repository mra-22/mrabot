from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import logging
from datetime import datetime

# ---------------- LOGGING ----------------
logging.basicConfig(
    filename='api.log',
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s'
)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

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
    logging.info("GET /")
    return jsonify({"message": "MR.A BOT API RUNNING 🚀"})

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

        logging.info(f"COMMAND: {cmd}")
        return jsonify({"status": "ok", "command": cmd})

    except Exception as e:
        logging.error(f"ERROR in send_command: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ---------------- STATS ----------------
@app.route("/stats")
def stats():
    try:
        logging.info("GET /stats")
        with open(STATS_FILE) as f:
            return jsonify(json.load(f))
    except Exception as e:
        logging.error(f"ERROR in /stats: {str(e)}")
        return jsonify({"groups": 0, "users": 0})

# ---------------- GROUPS ----------------
@app.route("/groups")
def groups():
    try:
        logging.info("GET /groups")
        with open(GROUP_FILE) as f:
            return jsonify(json.load(f))
    except Exception as e:
        logging.error(f"ERROR in /groups: {str(e)}")
        return jsonify([])

# ---------------- BROADCAST PROGRESS ----------------
@app.route("/progress")
def progress():
    try:
        logging.info("GET /progress")
        with open(PROGRESS_FILE) as f:
            return jsonify(json.load(f))
    except Exception as e:
        logging.error(f"ERROR in /progress: {str(e)}")
        return jsonify({"total": 0, "sent": 0})

# ---------------- BOT STATUS ----------------
@app.route("/status")
def status():
    try:
        logging.info("GET /status")
        with open(STATUS_FILE) as f:
            return jsonify({"status": f.read().strip()})
    except Exception as e:
        logging.error(f"ERROR in /status: {str(e)}")
        return jsonify({"status": "STOPPED"})

# ---------------- TOGGLE BOT ----------------
@app.route("/toggle-bot", methods=["POST"])
def toggle_bot():
    try:
        data = request.json
        active = data.get("active", False)

        with open(STATUS_FILE, "w") as f:
            f.write("RUNNING" if active else "STOPPED")

        logging.info(f"Bot status set to: {'RUNNING' if active else 'STOPPED'}")
        return jsonify({"success": True, "status": "RUNNING" if active else "STOPPED"})

    except Exception as e:
        logging.error(f"ERROR in toggle_bot: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ---------------- RUN SERVER ----------------
if __name__ == "__main__":
    logging.info("API Server started")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 3000)))
