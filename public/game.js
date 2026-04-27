const socket = io();

const loginModal = document.getElementById("loginModal");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const errorText = document.getElementById("errorText");

const character = document.getElementById("character");
const obstacle = document.getElementById("obstacle");
const scoreDisplay = document.getElementById("score");
const pauseBtn = document.getElementById("pauseBtn");
const startBtn = document.getElementById("startBtn");
const gameOverText = document.getElementById("gameOverText");
const restartBtn = document.getElementById("restartBtn");
const gameContainer = document.querySelector(".game-container");
const leaderboardList = document.getElementById("leaderboardList");
const playerName = document.getElementById("playerName");
const timerText = document.getElementById("timerText");
const gameText = document.getElementById("gameText");

let isAuthed = false;
let isGameStarted = false;
let isPaused = false;
let lastServerState = null;
let runFrame = 0;
let runInterval = null;

let tournamentStart = null;
let tournamentEnd = null;
let lobbyStart = null;
let tournamentStatus = null;
let winner = null;

const runImages = ["images/character_run1.png", "images/character_run2.png"];

function showError(message) {
  errorText.textContent = message;
  errorText.style.display = "block";
}

function showPopup(message) {
  alert(message);
}

function saveTournamentData(data) {
  tournamentStart = data.tournamentStart;
  tournamentEnd = data.tournamentEnd;
  lobbyStart = data.lobbyStart;
  tournamentStatus = data.tournamentStatus;
  winner = data.winner || null;
}

function lockGameControls() {
  if (tournamentStatus !== "active") {
    startBtn.disabled = true;
    pauseBtn.disabled = true;
    restartBtn.disabled = true;

    startBtn.style.pointerEvents = "none";
    pauseBtn.style.pointerEvents = "none";
    restartBtn.style.pointerEvents = "none";

    return;
  }

  startBtn.disabled = false;
  startBtn.style.pointerEvents = "auto";

  restartBtn.disabled = false;
  restartBtn.style.pointerEvents = "auto";

  pauseBtn.disabled = !isGameStarted;
  pauseBtn.style.pointerEvents = isGameStarted ? "auto" : "none";
}

loginBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  socket.emit("auth:join", { username, password });
});

passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") passwordInput.focus();
});

socket.on("auth:success", (data) => {
  isAuthed = true;
  loginModal.style.display = "none";
  playerName.textContent = `Player: ${data.username}`;
  saveTournamentData(data);
  updateTimer();
});

socket.on("auth:error", (message) => {
  showError(message);
});

socket.on("leaderboard:update", (data) => {
  saveTournamentData(data);

  leaderboardList.innerHTML = "";

  data.leaderboard.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = `${player.username} — ${player.score} $PODS`;
    leaderboardList.appendChild(li);
  });

  updateTimer();
});

socket.on("tournament:winner", (data) => {
  winner = data.winner || null;

  if (winner) {
    gameOverText.textContent = `🏆 Tournament Winner: ${winner.username} — ${winner.score} $PODS`;
  } else {
    gameOverText.textContent = "Tournament ended. No winner.";
  }

  gameOverText.classList.remove("hidden");

  isGameStarted = false;
  isPaused = false;
  stopRunningAnimation();

  startBtn.disabled = true;
  startBtn.textContent = "Tournament Ended";
  startBtn.style.pointerEvents = "none";

  pauseBtn.disabled = true;
  pauseBtn.style.pointerEvents = "none";

  restartBtn.disabled = true;
  restartBtn.style.pointerEvents = "none";
});

startBtn.addEventListener("click", () => {
  if (!isAuthed) {
    showError("Please sign in first.");
    return;
  }

  if (tournamentStatus === "not_open") {
    showPopup("Tournament lobby is not open yet.");
    return;
  }

  if (tournamentStatus === "waiting") {
    showPopup("Tournament has not started yet. Get ready!");
    return;
  }

  if (tournamentStatus === "ended") {
    showPopup("Tournament has ended.");
    return;
  }

  if (tournamentStatus !== "active") {
    showPopup("Tournament is not active yet.");
    return;
  }

  if (isGameStarted) return;

  isGameStarted = true;
  isPaused = false;

  scoreDisplay.textContent = "$PODS: 0";
  obstacle.style.left = "1000px";
  character.style.bottom = "0px";

  gameOverText.classList.add("hidden");
  restartBtn.classList.add("hidden");
  startBtn.style.display = "none";
  pauseBtn.disabled = false;
  pauseBtn.style.pointerEvents = "auto";
  pauseBtn.textContent = "Chill";

  gameText.style.display = "none";

  startRunningAnimation();
  socket.emit("game:start");
});

pauseBtn.addEventListener("click", () => {
  if (tournamentStatus !== "active") return;
  if (!isGameStarted) return;

  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "Resume" : "Chill";

  if (isPaused) {
    stopRunningAnimation();
  } else {
    startRunningAnimation();
  }
});

restartBtn.addEventListener("click", () => {
  if (tournamentStatus !== "active") return;

  isGameStarted = false;
  isPaused = false;
  lastServerState = null;

  gameOverText.classList.add("hidden");
  restartBtn.classList.add("hidden");
  scoreDisplay.textContent = "$PODS: 0";
  character.style.bottom = "0px";
  obstacle.style.left = "1000px";

  startBtn.style.display = "block";
  gameText.style.display = "block";

  lockGameControls();
});

function sendJump() {
  if (tournamentStatus !== "active") return;
  if (!isGameStarted || isPaused) return;

  socket.emit("game:jump");
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    sendJump();
  }
});

gameContainer.addEventListener("touchstart", (e) => {
  if (!e.target.closest("button")) {
    sendJump();
  }
});

socket.on("game:started", (state) => {
  lastServerState = state;
  saveTournamentData(state);
  lockGameControls();
});

socket.on("game:state", (state) => {
  if (isPaused) return;

  lastServerState = state;

  scoreDisplay.textContent = "$PODS: " + state.score;
  obstacle.style.left = state.obstacleX + "px";
  character.style.bottom = state.characterBottom + "px";

  if (state.isJumping) {
    character.src = "images/character_jump.png";
  }
});

socket.on("game:over", (data) => {
  isGameStarted = false;
  isPaused = false;

  stopRunningAnimation();

  gameOverText.textContent = `"you were supposed to jump!" Final score: ${data.finalScore}`;
  gameOverText.classList.remove("hidden");
  restartBtn.classList.remove("hidden");

  pauseBtn.disabled = true;
  pauseBtn.style.pointerEvents = "none";

  lockGameControls();
});

socket.on("game:error", (message) => {
  showPopup(message);

  isGameStarted = false;
  isPaused = false;
  stopRunningAnimation();

  startBtn.style.display = "block";
  pauseBtn.disabled = true;
  pauseBtn.style.pointerEvents = "none";

  lockGameControls();
});

function startRunningAnimation() {
  if (runInterval) clearInterval(runInterval);

  runInterval = setInterval(() => {
    if (!isGameStarted || isPaused) return;

    runFrame = (runFrame + 1) % runImages.length;

    const bottom = parseInt(window.getComputedStyle(character).bottom, 10);

    if (bottom <= 5) {
      character.src = runImages[runFrame];
    }
  }, 150);
}

function stopRunningAnimation() {
  clearInterval(runInterval);
  runInterval = null;
}

function updateTimer() {
  if (!tournamentStart || !tournamentEnd || !lobbyStart) {
    timerText.textContent = "";
    lockGameControls();
    return;
  }

  const now = Date.now();

  if (now < lobbyStart) {
    tournamentStatus = "not_open";
    timerText.textContent = `Lobby opens in: ${formatTime(lobbyStart - now)}`;
    startBtn.textContent = "Lobby Not Open";
    lockGameControls();
    return;
  }

  if (now < tournamentStart) {
    tournamentStatus = "waiting";
    timerText.textContent = `Tournament starts in: ${formatTime(tournamentStart - now)}`;
    startBtn.textContent = "Get Ready...";
    lockGameControls();
    return;
  }

  if (now <= tournamentEnd) {
    tournamentStatus = "active";
    timerText.textContent = `Tournament ends in: ${formatTime(tournamentEnd - now)}`;
    startBtn.textContent = "Ready when you are!";
    lockGameControls();
    return;
  }

  tournamentStatus = "ended";
  timerText.textContent = "Tournament ended";
  startBtn.textContent = "Tournament Ended";

  if (winner) {
    gameOverText.textContent = `🏆 Tournament Winner: ${winner.username} — ${winner.score} $PODS`;
    gameOverText.classList.remove("hidden");
  }

  lockGameControls();
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

lockGameControls();
setInterval(updateTimer, 1000);
