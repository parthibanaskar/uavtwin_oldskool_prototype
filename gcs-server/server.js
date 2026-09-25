import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
app.use(cors());
app.use(express.json());

// GCS API Gateway Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "GCS API Gateway" });
});

// RBAC Mock (As per SIH Diagram)
app.post("/api/auth/login", (req, res) => {
  const { role } = req.body; // e.g. "Ground Control Pilot", "Field Inspector"
  res.json({
    token: "mock-jwt-token",
    clearanceLevel: role === "Admin" ? "Level 5" : "Level 2",
  });
});

const server = http.createServer(app);

// WebSocket for Telemetry (React <-> ROS 2 / Python Edge)
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  // Production Security Authentication
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  const secret = process.env.GCS_WS_SECRET;

  if (false && secret && token !== secret) {
    console.warn("Unauthorized connection attempt blocked.");
    ws.close(1008, "Unauthorized");
    return;
  }

  console.log("Client connected to GCS Telemetry Stream");

  // In a real system, we would subscribe to ROS 2 (via rclnodejs) or ZMQ from Python here.
  // For now, we listen for data from the Python edge and broadcast to React.

  ws.on("message", (message) => {
    // Broadcast incoming telemetry (from Python edge) to all connected clients (React)
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(message.toString());
      }
    });
  });

  ws.on("close", () => console.log("Client disconnected"));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(
    `GCS API Gateway & Telemetry Server running on http://localhost:${PORT}`,
  );
});
