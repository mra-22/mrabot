from flask import Flask, request, jsonify
import json

app = Flask(__name__)

COMMAND_QUEUE = "command_queue.txt"

@app.route("/send-command", methods=["POST"])
def send_command():
    data = request.json
    cmd = data.get("command")

    if not cmd:
        return jsonify({"error": "No command"}), 400

    with open(COMMAND_QUEUE, "a") as f:
        f.write(cmd + "\n")

    return jsonify({"status": "ok"})


@app.route("/stats", methods=["GET"])
def stats():
    try:
        with open("bot_stats.json") as f:
            return jsonify(json.load(f))
    except:
        return jsonify({"groups": 0, "users": 0})


@app.route("/groups", methods=["GET"])
def groups():
    try:
        with open("group_list.json") as f:
            return jsonify(json.load(f))
    except:
        return jsonify([])


@app.route("/progress", methods=["GET"])
def progress():
    try:
        with open("broadcast_progress.json") as f:
            return jsonify(json.load(f))
    except:
        return jsonify({"total": 0, "sent": 0})


@app.route("/status", methods=["GET"])
def status():
    try:
        with open("bot_status.txt") as f:
            return jsonify({"status": f.read().strip()})
    except:
        return jsonify({"status": "STOPPED"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
