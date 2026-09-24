#!/bin/bash
# Use Railway's port or default to 3001
PORT=${PORT:-3001}

# Start GCS Node.js server in the background
cd /app/gcs-server
npm start &
GCS_PID=$!

# Wait a second for it to start
sleep 2

# Start Python AI server in the foreground
cd /app/edge-server/python
export GCS_WS_URL="ws://localhost:$PORT"
python main.py

# If python crashes, kill node
kill $GCS_PID
