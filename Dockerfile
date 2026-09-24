# Use an image that has both Python and Node.js
FROM nikolaik/python-nodejs:python3.11-nodejs20-slim

WORKDIR /app

# Copy everything
COPY . .

# Install Python requirements
RUN pip install --no-cache-dir numpy opencv-python-headless websockets asyncio

# Install Node requirements DURING BUILD (not at runtime)
RUN cd gcs-server && npm install

# Make the start script executable
RUN sed -i "s/\\r//" start_both.sh && chmod +x start_both.sh

# Expose the GCS WebSocket port
EXPOSE 3001

# Run both servers
CMD ["./start_both.sh"]
