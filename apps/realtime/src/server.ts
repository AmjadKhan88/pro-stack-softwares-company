import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "socket.io";
import { isBearerMatch } from "./bearer";
import { loadConfig } from "./config";
import { parseRoom, userRoom } from "./contract";
import { MAX_EMIT_BODY_BYTES, parseEmitBody } from "./emit-body";
import { canJoin } from "./rooms";
import { verifyRealtimeToken, type RealtimeClaims } from "./token";

const config = loadConfig();

const MAX_SOCKETS_PER_USER = 8;
const MAX_PROJECT_ROOMS = 20;
const JOINS_PER_MINUTE = 30;

function log(level: "info" | "warn" | "error", message: string, extra: Record<string, unknown> = {}) {
  // Never log tickets or secrets.
  console.log(JSON.stringify({ level, message, time: new Date().toISOString(), ...extra }));
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

/** Reads a request body, giving up (null) if it grows past the limit. */
function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (value: string | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) return finish(null);
      chunks.push(chunk);
    });
    req.on("end", () => finish(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => finish(null));
  });
}

const httpServer = createServer(async (req, res) => {
  try {
    const path = (req.url ?? "").split("?")[0];

    // Render checks this to know the service is alive.
    if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true });

    // The website sends "something changed" hints here, with a secret password.
    if (req.method === "POST" && path === "/emit") {
      if (!isBearerMatch(req.headers.authorization ?? null, config.emitSecret)) {
        return send(res, 401, { error: "Not allowed." });
      }
      const text = await readBody(req, MAX_EMIT_BODY_BYTES);
      if (text === null) return send(res, 413, { error: "Too large." });
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return send(res, 400, { error: "Invalid JSON." });
      }
      const events = parseEmitBody(parsed);
      if (!events) return send(res, 400, { error: "Invalid events." });
      for (const event of events) io.to(event.room).emit(event.event, event.data);
      return send(res, 200, { ok: true, count: events.length });
    }

    return send(res, 404, { error: "Not found." });
  } catch (error) {
    log("error", "request failed", { message: error instanceof Error ? error.message : "unknown" });
    if (!res.headersSent) send(res, 500, { error: "Server error." });
  }
});

const io = new Server(httpServer, {
  cors: { origin: config.origins },
  transports: ["websocket"],
  maxHttpBufferSize: 32_000,
  // Browsers always send an Origin. Only your own website addresses may connect.
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    callback(null, typeof origin === "string" && config.origins.includes(origin));
  },
});

const socketsPerUser = new Map<string, number>();

// Every connection needs a valid, unexpired ticket from the website.
io.use((socket, next) => {
  const claims = verifyRealtimeToken(socket.handshake.auth?.token, config.tokenSecret);
  if (!claims) return next(new Error("unauthorized"));
  if ((socketsPerUser.get(claims.sub) ?? 0) >= MAX_SOCKETS_PER_USER)
    return next(new Error("too many connections"));
  socket.data.claims = claims;
  next();
});

io.on("connection", (socket) => {
  const claims = socket.data.claims as RealtimeClaims;
  socketsPerUser.set(claims.sub, (socketsPerUser.get(claims.sub) ?? 0) + 1);
  void socket.join(userRoom(claims.sub)); // their own room, nobody else's

  // When the ticket runs out, close the connection. The page reconnects with a fresh ticket.
  const expiry = setTimeout(() => socket.disconnect(true), Math.max(1000, claims.exp * 1000 - Date.now()));

  let windowStart = Date.now();
  let joins = 0;

  socket.on("join", (room: unknown, ack: unknown) => {
    const reply = (ok: boolean) => {
      if (typeof ack === "function") (ack as (result: { ok: boolean }) => void)({ ok });
    };
    const now = Date.now();
    if (now - windowStart > 60_000) {
      windowStart = now;
      joins = 0;
    }
    joins += 1;
    const parsed = parseRoom(room);
    const projectRooms = [...socket.rooms].filter((name) => name.startsWith("project:")).length;
    // Only project conversations can be joined, only when the ticket lists them, and only a few at a time.
    if (
      joins > JOINS_PER_MINUTE ||
      !parsed ||
      parsed.type !== "project" ||
      !canJoin(claims, room) ||
      projectRooms >= MAX_PROJECT_ROOMS
    ) {
      return reply(false);
    }
    void socket.join(room as string);
    reply(true);
  });

  socket.on("leave", (room: unknown) => {
    if (parseRoom(room)?.type === "project") void socket.leave(room as string);
  });

  socket.on("disconnect", () => {
    clearTimeout(expiry);
    const left = (socketsPerUser.get(claims.sub) ?? 1) - 1;
    if (left <= 0) socketsPerUser.delete(claims.sub);
    else socketsPerUser.set(claims.sub, left);
  });
});

httpServer.listen(config.port, "0.0.0.0", () => log("info", "live service started", { port: config.port }));

function shutdown() {
  log("info", "shutting down");
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("unhandledRejection", (reason) => log("error", "unhandled rejection", { reason: String(reason) }));
