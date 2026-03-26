#!/bin/sh
# Jalankan Python API di background
python api.py &

# Jalankan Node WA bot di foreground
node index.js
