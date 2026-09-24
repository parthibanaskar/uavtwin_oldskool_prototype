# Use an image that has both Python and Node.js
FROM nikolaik/python-nodejs:python3.11-nodejs20-slim

WORKDIR /app

# Copy everything
COPY . .

# Install Python requirements (Lightweight mode - no PyTorch)
RUN pip install --no-cache-dir numpy opencv-python-headless websockets asyncio

# Make the start script executable
RUN chmod +x start_both.sh

# Expose the GCS WebSocket port
EXPOSE 3001

# Run both servers
CMD ["./start_both.sh"]
