# Use official python slim image for lightweight deployment
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
# We don't install torch by default to support Lightweight Mode on free tiers.
# If you want AI inference, you must provide enough RAM and install torch.
COPY requirements.txt .
RUN pip install --no-cache-dir numpy opencv-python-headless websockets asyncio

# Copy application files
COPY . .

# Run the watchdog by default
CMD ["python", "watchdog.py"]
