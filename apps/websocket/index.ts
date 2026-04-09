import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

// ─── Aconvi WebSocket Notification Server ────────────────────────────────────
// Handles real-time events for: incident updates, new notices, push fallbacks.
// Also exposes a POST /internal/emit endpoint so the Next.js API (serverless)
// can forward broadcast events without maintaining a persistent WS connection.

const INTERNAL_SECRET =
  process.env.WS_INTERNAL_SECRET ?? "aconvi-dev";

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? "*" }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGIN ?? "*",
    methods: ["GET", "POST"],
  },
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "Aconvi WS Server running", clients: io.engine.clientsCount });
});

// ─── Internal emit endpoint ───────────────────────────────────────────────────
// Called by the Next.js API to broadcast events to rooms/users.
// Protected by a shared secret (set WS_INTERNAL_SECRET in .env on both sides).
app.post("/internal/emit", (req, res) => {
  const secret = req.headers["x-internal-secret"];
  if (secret !== INTERNAL_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { event, data } = req.body as { event: string; data: any };

  if (!event) {
    res.status(400).json({ error: "Missing event" });
    return;
  }

  // Route based on data shape:
  // - { room: "tenant:xxx" }  → emit to tenant room
  // - { userId: "xxx" }       → emit to user personal room
  // - no room/userId          → global broadcast
  if (data?.room) {
    io.to(data.room).emit(event, data);
  } else if (data?.userId) {
    io.to(`user:${data.userId}`).emit(event, data);
  } else {
    io.emit(event, data);
  }

  res.json({ ok: true, event, clients: io.engine.clientsCount });
});

// ─── Socket auth middleware ───────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    socket.data.token = token;
  }
  // TODO: validate against better-auth session in production
  next();
});

// ─── Socket event handlers ────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("[WS] Client connected:", socket.id);

  // ── Room: tenant-wide broadcasts (AF + all vecinos of community) ──────────
  socket.on("join-tenant", (tenantId: string) => {
    void socket.join(`tenant:${tenantId}`);
    console.log(`[WS] ${socket.id} → tenant:${tenantId}`);
  });

  // ── Room: user personal (for targeted vecino notifications) ──────────────
  socket.on("join-user", (userId: string) => {
    void socket.join(`user:${userId}`);
    console.log(`[WS] ${socket.id} → user:${userId}`);
  });

  // ── Incident: updated status ──────────────────────────────────────────────
  socket.on(
    "incident-updated",
    (payload: { id: string; status: string; tenantId: string }) => {
      socket
        .to(`tenant:${payload.tenantId}`)
        .emit("notify-incident-updated", payload);
    },
  );

  // ── Incident: closed by AF → ask vecino to rate ───────────────────────────
  socket.on(
    "incident-closed",
    (payload: {
      incidentId: string;
      vecinoId: string;
      tenantId: string;
      message: string;
    }) => {
      console.log(
        `[WS] Incident ${payload.incidentId} closed → rating request to vecino ${payload.vecinoId}`,
      );
      io.to(`user:${payload.vecinoId}`).emit("rating-request", {
        incidentId: payload.incidentId,
        message: payload.message,
        timestamp: new Date().toISOString(),
      });
      socket.to(`tenant:${payload.tenantId}`).emit("notify-incident-updated", {
        id: payload.incidentId,
        status: "RESUELTO",
        tenantId: payload.tenantId,
      });
    },
  );

  // ── Notice: new comunicado/aviso published ────────────────────────────────
  socket.on(
    "notice-published",
    (payload: { noticeId: string; tenantId: string; type: string; title: string }) => {
      socket.to(`tenant:${payload.tenantId}`).emit("notify-new-notice", payload);
    },
  );

  // ── Rating submitted by vecino ────────────────────────────────────────────
  socket.on(
    "rating-submitted",
    (payload: { incidentId: string; rating: number; tenantId: string }) => {
      console.log(
        `[WS] Rating ${payload.rating}/5 for incident ${payload.incidentId}`,
      );
      socket
        .to(`tenant:${payload.tenantId}`)
        .emit("notify-rating-received", payload);
    },
  );

  socket.on("disconnect", () => {
    console.log("[WS] Client disconnected:", socket.id);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`[WS] Aconvi WebSocket Server running on port ${PORT}`);
  console.log(`[WS] Internal emit endpoint: POST http://localhost:${PORT}/internal/emit`);
});
