const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const PASSWORD = "oceans";

const GAME_WIDTH = 1000;
const CHARACTER_X = 50;
const CHARACTER_WIDTH = 100;
const OBSTACLE_WIDTH = 140;

const GROUND_Y = 0;
const JUMP_HEIGHT = 150;
const JUMP_DURATION_MS = 1200;

const OBSTACLE_SPEED = 360; // pixels per second
const START_OBSTACLE_X = 1000;
const RESET_OBSTACLE_X = 1000;
const OFFSCREEN_X = -80;

const COLLISION_LEFT = 40;
const COLLISION_RIGHT = 130;
const COLLISION_HEIGHT = 60;

const TICK_RATE = 1000 / 30;

const TOURNAMENT_START = Date.now();
const TOURNAMENT_DURATION_MS = 24 * 60 * 60 * 1000;
const TOURNAMENT_END = TOURNAMENT_START + TOURNAMENT_DURATION_MS;

const users = new Map();
const leaderboard = new Map();
const sessions = new Map();

function cleanUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function validUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

function tournamentActive() {
  return Date.now() >= TOURNAMENT_START && Date.now() <= TOURNAMENT_END;
}

function getLeaderboard() {
  return [...leaderboard.values()]
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
    .slice(0, 20);
}

function calculateCharacterBottom(session, now) {
  if (!session.isJumping) return 0;

  const elapsed = now - session.jumpStartTime;

  if (elapsed >= JUMP_DURATION_MS) {
    session.isJumping = false;
    return 0;
  }

  const progress = elapsed / JUMP_DURATION_MS;
  return Math.sin(progress * Math.PI) * JUMP_HEIGHT;
}

function emitLeaderboard() {
  io.emit("leaderboard:update", {
    leaderboard: getLeaderboard(),
    tournamentStart: TOURNAMENT_START,
    tournamentEnd: TOURNAMENT_END,
    serverTime: Date.now(),
  });
}

function endSession(socket, session, reason) {
  session.active = false;

  const previousBest = leaderboard.get(session.username)?.score || 0;

  if (session.score > previousBest) {
    leaderboard.set(session.username, {
      username: session.username,
      score: session.score,
      updatedAt: Date.now(),
    });
  }

  socket.emit("game:over", {
    reason,
    finalScore: session.score,
    bestScore: Math.max(previousBest, session.score),
  });

  emitLeaderboard();
}

function startGameLoop(socket, session) {
  session.interval = setInterval(() => {
    if (!session.active) return;

    const now = Date.now();
    const dt = Math.min((now - session.lastTick) / 1000, 0.05);
    session.lastTick = now;

    if (!tournamentActive()) {
      clearInterval(session.interval);
      endSession(socket, session, "Tournament ended");
      return;
    }

    session.obstacleX -= OBSTACLE_SPEED * dt;

    if (session.obstacleX < OFFSCREEN_X) {
      session.obstacleX = RESET_OBSTACLE_X;
      session.score += 1;
    }

    const characterBottom = calculateCharacterBottom(session, now);

    const obstacleInCollisionZone =
      session.obstacleX < COLLISION_RIGHT && session.obstacleX > COLLISION_LEFT;

    const characterTooLow = characterBottom < COLLISION_HEIGHT;

    if (obstacleInCollisionZone && characterTooLow) {
      clearInterval(session.interval);
      endSession(socket, session, "Hit obstacle");
      return;
    }

    socket.emit("game:state", {
      score: session.score,
      obstacleX: Math.round(session.obstacleX),
      characterBottom: Math.round(characterBottom),
      isJumping: session.isJumping,
    });
  }, TICK_RATE);
}

io.on("connection", (socket) => {
  socket.emit("leaderboard:update", {
    leaderboard: getLeaderboard(),
    tournamentStart: TOURNAMENT_START,
    tournamentEnd: TOURNAMENT_END,
    serverTime: Date.now(),
  });

  socket.on("auth:join", ({ username, password }) => {
    username = cleanUsername(username);

    if (password !== PASSWORD) {
      socket.emit("auth:error", "Wrong password");
      return;
    }

    if (!validUsername(username)) {
      socket.emit(
        "auth:error",
        "Username must be 3-20 letters, numbers, or underscores.",
      );
      return;
    }

    if (users.has(username) && users.get(username) !== socket.id) {
      socket.emit("auth:error", "Username already taken.");
      return;
    }

    users.set(username, socket.id);
    socket.data.username = username;

    if (!leaderboard.has(username)) {
      leaderboard.set(username, {
        username,
        score: 0,
        updatedAt: Date.now(),
      });
    }

    socket.emit("auth:success", {
      username,
      tournamentStart: TOURNAMENT_START,
      tournamentEnd: TOURNAMENT_END,
    });

    emitLeaderboard();
  });

  socket.on("game:start", () => {
    const username = socket.data.username;

    if (!username) {
      socket.emit("game:error", "Sign in first.");
      return;
    }

    if (!tournamentActive()) {
      socket.emit("game:error", "Tournament is not active.");
      return;
    }

    const oldSession = sessions.get(socket.id);
    if (oldSession?.interval) clearInterval(oldSession.interval);

    const session = {
      username,
      active: true,
      score: 0,
      obstacleX: START_OBSTACLE_X,
      isJumping: false,
      jumpStartTime: 0,
      lastJumpAt: 0,
      startedAt: Date.now(),
      lastTick: Date.now(),
      interval: null,
    };

    sessions.set(socket.id, session);

    socket.emit("game:started", {
      score: 0,
      obstacleX: START_OBSTACLE_X,
    });

    startGameLoop(socket, session);
  });

  socket.on("game:jump", () => {
    const session = sessions.get(socket.id);
    if (!session || !session.active) return;

    const now = Date.now();

    if (session.isJumping) return;
    if (now - session.lastJumpAt < 250) return;

    session.isJumping = true;
    session.jumpStartTime = now;
    session.lastJumpAt = now;
  });

  socket.on("game:restart", () => {
    socket.emit("game:ready");
  });

  socket.on("disconnect", () => {
    const username = socket.data.username;

    if (username && users.get(username) === socket.id) {
      users.delete(username);
    }

    const session = sessions.get(socket.id);
    if (session?.interval) clearInterval(session.interval);

    sessions.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Pacific Pods server running on port ${PORT}`);
});
