#!/bin/bash
# Force the port so Railway doesn't override it
export PORT=3001

# Start GCS Node.js server in the background
cd /app/gcs-server
npm start &
GCS_PID=\$!

# Wait a second for it to start
sleep 2

# Start Python AI server in the foreground
cd /app/edge-server/python
export GCS_WS_URL="ws://localhost:3001"
python main.py

# If python crashes, kill node
kill \
