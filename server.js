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
const ARENA = { width: 1800, height: 1000 };

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "JOBBY Escape" }));

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
function playerFor(socket, name) {
  return {
    id: socket.id,
    name: String(name || "Player").replace(/[<>]/g, "").slice(0, 18) || "Player",
    x: 160 + Math.random() * 120,
    y: 160 + Math.random() * 120,
    color: ["#f5cf45", "#7bd7ff", "#ff8d9b", "#a8f0b0", "#d0a4ff"][Math.floor(Math.random() * 5)],
    score: 0,
    alive: true
  };
}
function joinRoom(socket, room, name) {
  if (!rooms.has(room)) rooms.set(room, { code: room, players: new Map(), started: false });
  const data = rooms.get(room);
  if (data.players.size >= 8) return socket.emit("notice", "Room is full. Choose another room.");
  if (data.started && data.players.size) return socket.emit("notice", "This match has already started.");
  const player = playerFor(socket, name);
  data.players.set(socket.id, player);
  socket.join(room);
  socket.data.room = room;
  socket.emit("joined", { room, playerId: socket.id, players: [...data.players.values()], arena: ARENA });
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
  else io.to(room).emit("players", [...data.players.values()]);
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
    if (!room || !rooms.has(room)) return socket.emit("notice", "Room not found. Check the code and try again.");
    joinRoom(socket, room, name);
  });
  socket.on("quick-match", ({ name } = {}) => {
    leaveRoom(socket);
    let room = waiting.find(code => rooms.has(code) && rooms.get(code).players.size < 4);
    if (!room) {
      room = makeCode();
      while (rooms.has(room)) room = makeCode();
      rooms.set(room, { code: room, players: new Map(), started: false });
      waiting.push(room);
    }
    joinRoom(socket, room, name);
    const data = rooms.get(room);
    if (data && data.players.size >= 4) {
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
    if (data.players.size < 1) return;
    data.started = true;
    const index = waiting.indexOf(room);
    if (index >= 0) waiting.splice(index, 1);
    io.to(room).emit("match-start", { room, players: [...data.players.values()] });
  });
  socket.on("move", ({ x, y } = {}) => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const player = rooms.get(room).players.get(socket.id);
    if (!player || !Number.isFinite(x) || !Number.isFinite(y)) return;
    player.x = Math.max(24, Math.min(ARENA.width - 24, x));
    player.y = Math.max(24, Math.min(ARENA.height - 24, y));
    socket.to(room).emit("player-moved", { id: socket.id, x: player.x, y: player.y });
  });
  socket.on("score", amount => {
    const room = socket.data.room;
    if (!room || !rooms.has(room)) return;
    const player = rooms.get(room).players.get(socket.id);
    if (!player || !Number.isFinite(amount)) return;
    player.score = Math.max(player.score, Math.min(9999, Math.max(0, amount)));
    io.to(room).emit("scores", [...rooms.get(room).players.values()].map(p => ({ id: p.id, name: p.name, score: p.score })));
  });
  socket.on("disconnect", () => leaveRoom(socket));
});
setInterval(() => {
  for (const [room, data] of rooms) {
    if (!data.players.size) rooms.delete(room);
    else io.to(room).emit("players", [...data.players.values()]);
  }
}, 1500).unref();

server.listen(PORT, "0.0.0.0", () => console.log("JOBBY Escape server listening on " + PORT));