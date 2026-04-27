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
let renderFrameId = null;
let runFrame = 0;
let runInterval = null;
let tournamentEnd = null;

const runImages = ["images/character_run1.png", "images/character_run2.png"];

function showError(message) {
  errorText.textContent = message;
  errorText.style.display = "block";
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
  tournamentEnd = data.tournamentEnd;
});

socket.on("auth:error", (message) => {
  showError(message);
});

socket.on("leaderboard:update", (data) => {
  tournamentEnd = data.tournamentEnd;

  leaderboardList.innerHTML = "";

  data.leaderboard.forEach((player, index) => {
    const li = document.createElement("li");
    li.textContent = `${player.username} — ${player.score} $PODS`;
    leaderboardList.appendChild(li);
  });
});

startBtn.addEventListener("click", () => {
  if (!isAuthed) {
    showError("Please sign in first.");
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
  pauseBtn.textContent = "Chill";

  gameText.style.display = "none";

  startRunningAnimation();
  socket.emit("game:start");
});

pauseBtn.addEventListener("click", () => {
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
});

function sendJump() {
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
});

socket.on("game:error", (message) => {
  alert(message);
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
  if (!tournamentEnd) {
    timerText.textContent = "";
    return;
  }

  const remaining = Math.max(0, tournamentEnd - Date.now());

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  timerText.textContent = `Tournament: ${hours}h ${minutes}m ${seconds}s`;

  if (remaining <= 0) {
    timerText.textContent = "Tournament ended";
  }
}

setInterval(updateTimer, 1000);
