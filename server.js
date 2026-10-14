const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const waiting = [];
const ROOM_CAP = 16;
const ARENA = { width: 960, height: 540 };

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "JOBBY Escape", mode: "2d-platformer" }));

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
function cleanName(value) {
  return String(value || "Player").replace(/[<>]/g, "").trim().slice(0, 18) || "Player";
}
function playerFor(socket, name) {
  return {
    id: socket.id, name: cleanName(name),
    x: 70 + Math.random() * 50, y: 400,
    color: ["#f5cf45", "#7bd7ff", "#ff8d9b", "#a8f0b0", "#d0a4ff", "#ffb66b"][Math.floor(Math.random() * 6)],
    score: 0, alive: true, escaped: false
  };
}
function joinRoom(socket, room, name) {
  if (!rooms.has(room)) rooms.set(room, { code: room, players: new Map(), started: false, host: socket.id });
  const data = rooms.get(room);
  if (data.players.size >= ROOM_CAP) return socket.emit("notice", "This room is full. Try another room.");
  const player = playerFor(socket, name);
  data.players.set(socket.id, player);
  socket.join(room);
  socket.data.room = room;
  socket.emit("joined", { room, playerId: socket.id, players: [...data.players.values()], arena: ARENA, host: data.host });
  io.to(room).emit("players", [...data.players.values()]);
  io.to(room).emit("notice", player.name + " joined the room.");
}
function leaveRoom(socket) {
  const room = socket.data.room;
  if (!room || !rooms.has(room)) return;
  const data = rooms.get(room);
  const player = data.players.get(socket.id);
  data.players.delete(socket.id);
  socket.leave(room);
  socket.data.room = null;
  if (player) io.to(room).emit("notice", player.name + " left the room.");
  if (!data.players.size) rooms.delete(room);
  else {
    if (data.host === socket.id) data.host = data.players.keys().next().value;
    io.to(room).emit("players", [...data.players.values()]);
  }
}
io.on("connection", socket => {
  socket.on("create-room", ({ name } = {}) => {
    leaveRoom(socket);
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    joinRoom(socket, code, name);
  });
  socket.on("join-room", ({ name, code } = {}) => {
    leaveRoom(socket);
    const room = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    if (!room || !rooms.has(room)) return socket.emit("notice", "Room not found. Check the invite code.");
    joinRoom(socket, room, name);
  });
  socket.on("quick-match", ({ name } = {}) => {
    leaveRoom(socket);
    let room = waiting.find(code => rooms.has(code) && !rooms.get(code).started && rooms.get(code).players.size < ROOM_CAP);
    if (!room) {
      room = makeCode();
      while (rooms.has(room)) room = makeCode();
      rooms.set(room, { code: room, players: new Map(), started: false, host: socket.id });
      waiting.push(room);
    }
    joinRoom(socket, room, name);
    const data = rooms.get(room);
    if (data && data.players.size >= 2) {
      data.started = true;
      const index = waiting.indexOf(room);
      if (index >= 0) waiting.splice(index, 1);
      io.to(room).emit("match-start", { room, players: [...data.players.values()] });
    }
  });
  socket.on("start-match", () => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const data = rooms.get(room);
    if (data.host !== socket.id) return socket.emit("notice", "Only the room host can start the match.");
    if (data.started) return;
    data.started = true;
    const index = waiting.indexOf(room);
    if (index >= 0) waiting.splice(index, 1);
    io.to(room).emit("match-start", { room, players: [...data.players.values()] });
  });
  socket.on("move", ({ x, y, vx, vy } = {}) => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const player = rooms.get(room).players.get(socket.id);
    if (!player || !Number.isFinite(x) || !Number.isFinite(y)) return;
    player.x = Math.max(12, Math.min(ARENA.width - 12, x));
    player.y = Math.max(12, Math.min(ARENA.height - 12, y));
    if (Number.isFinite(vx)) player.vx = Math.max(-30, Math.min(30, vx));
    if (Number.isFinite(vy)) player.vy = Math.max(-30, Math.min(30, vy));
    socket.to(room).emit("player-moved", { id: socket.id, x: player.x, y: player.y, vx: player.vx || 0, vy: player.vy || 0 });
  });
  socket.on("score", amount => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const player = rooms.get(room).players.get(socket.id);
    if (!player || !Number.isFinite(amount)) return;
    player.score = Math.max(player.score, Math.min(9999, Math.max(0, amount)));
    io.to(room).emit("scores", [...rooms.get(room).players.values()].map(p => ({ id: p.id, name: p.name, score: p.score, escaped: p.escaped })));
  });
  socket.on("chat-message", value => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const player = rooms.get(room).players.get(socket.id);
    const message = String(value || "").replace(/[<>]/g, "").trim().slice(0, 240);
    if (!player || !message) return;
    io.to(room).emit("chat-message", { id: socket.id, name: player.name, message, at: Date.now() });
  });
  socket.on("voice-signal", ({ to, signal } = {}) => {
    const room = socket.data.room;
    if (!room || !rooms.has(room) || typeof to !== "string" || !signal) return;
    if (!rooms.get(room).players.has(to) || to === socket.id) return;
    io.to(to).emit("voice-signal", { from: socket.id, signal });
  });
  socket.on("disconnect", () => {
    const room = socket.data.room;
    leaveRoom(socket);
    for (const code of waiting.slice()) {
      if (!rooms.has(code) || rooms.get(code).players.size >= ROOM_CAP) {
        const index = waiting.indexOf(code);
        if (index >= 0) waiting.splice(index, 1);
      }
    }
  });
});
setInterval(() => {
  for (const [room, data] of rooms) {
    if (!data.players.size) rooms.delete(room);
    else io.to(room).emit("players", [...data.players.values()]);
  }
}, 1500).unref();

server.listen(PORT, "0.0.0.0", () => console.log("JOBBY Escape server listening on " + PORT));