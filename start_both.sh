#!/bin/bash
# Start GCS Node.js server in the background
cd /app/gcs-server
npm install
npm start &
GCS_PID=$!

# Wait a second for it to start
sleep 2

# Start Python AI server in the foreground
cd /app/edge-server/python
export GCS_WS_URL="ws://localhost:3001"
python main.py

# If python crashes, kill node
kill 
