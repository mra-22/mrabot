#!/bin/sh
# start.sh

# ---------------- SET LOG ----------------
LOG_FILE="./api.log"
echo "===== STARTING BOT & API at $(date) =====" >> $LOG_FILE

# ---------------- START FLASK API ----------------
# jalankan API di background & redirect stdout/stderr ke log
python api.py >> $LOG_FILE 2>&1 &

# ---------------- START NODE BOT ----------------
# jalankan Node WA bot di foreground
node index.js
