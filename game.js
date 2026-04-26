const validPassword = "oceans";

function checkPassword() {
  const input = document.getElementById("passwordInput").value;
  const modal = document.getElementById("passwordModal");
  const errorText = document.getElementById("errorText");

  if (input === validPassword) {
    modal.style.display = "none";
    initializeGame();
  } else {
    errorText.style.display = "block";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // Wait for user to enter password before starting game
});

function initializeGame() {
  const character = document.getElementById("character");
  const obstacle = document.getElementById("obstacle");
  const scoreDisplay = document.getElementById("score");
  const pauseBtn = document.getElementById("pauseBtn");
  const startBtn = document.getElementById("startBtn");
  const gameOverText = document.getElementById("gameOverText");
  const restartBtn = document.getElementById("restartBtn");
  const gameContainer = document.querySelector(".game-container");

  let isJumping = false;
  let isPaused = false;
  let isGameStarted = false;
  let score = 0;
  let obstacleLeft = 1000;
  let animationFrameId = null;

  // 🆕 Running animation variables
  let runFrame = 0;
  let runInterval = null;
  const runImages = [
    "images/character_run1.png", // first running frame
    "images/character_run2.png", // second running frame
  ];

  function jump() {
    if (isJumping || isPaused || !isGameStarted) return;
    isJumping = true;

    // stop running animation while jumping
    stopRunningAnimation();

    // Optional jump sprite
    if (characterJumpImageExists()) {
      character.src = "images/character_jump.png";
    }

    let position = 0;

    const upInterval = setInterval(() => {
      if (isPaused) return;
      if (position >= 150) {
        clearInterval(upInterval);
        const downInterval = setInterval(() => {
          if (isPaused) return;
          if (position <= 0) {
            clearInterval(downInterval);
            isJumping = false;
            // resume running animation after landing
            if (isGameStarted && !isPaused) startRunningAnimation();
          } else {
            position -= 5;
            character.style.bottom = position + "px";
          }
        }, 20);
      } else {
        position += 5;
        character.style.bottom = position + "px";
      }
    }, 20);
  }

  // ✅ Keyboard control (PC)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      jump();
    }
  });

  // ✅ Tap-to-jump support (Mobile)
  gameContainer.addEventListener("touchstart", (e) => {
    if (!e.target.closest("button")) {
      jump();
    }
  });

  startBtn.addEventListener("click", () => {
    if (!isGameStarted) {
      isGameStarted = true;
      isPaused = false;
      score = 0;
      obstacleLeft = 1000;
      scoreDisplay.textContent = "$PODS: 0";
      gameOverText.classList.add("hidden");
      restartBtn.classList.add("hidden");
      pauseBtn.disabled = false;
      startBtn.style.display = "none";
      startRunningAnimation(); // 🆕 start sprite animation
      moveObstacle();
    }
  });

  pauseBtn.addEventListener("click", () => {
    if (!isGameStarted) return;
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? "Resume" : "Pause";
    if (isPaused) {
      cancelAnimationFrame(animationFrameId);
      stopRunningAnimation(); // 🆕 pause sprite
    } else {
      startRunningAnimation(); // 🆕 resume sprite
      moveObstacle();
    }
  });

  function endGame() {
    isPaused = true;
    isGameStarted = false;
    cancelAnimationFrame(animationFrameId);
    pauseBtn.disabled = true;
    stopRunningAnimation(); // 🆕 stop running loop
    gameOverText.classList.remove("hidden");
    restartBtn.classList.remove("hidden");
  }

  function moveObstacle() {
    if (isPaused || !isGameStarted) return;
    if (obstacleLeft < -60) {
      obstacleLeft = 1000;
      score++;
      scoreDisplay.textContent = "$PODS: " + score;
    } else {
      obstacleLeft -= 10;
    }

    obstacle.style.left = obstacleLeft + "px";

    const characterBottom = parseInt(window.getComputedStyle(character).bottom);
    if (obstacleLeft < 110 && obstacleLeft > 40 && characterBottom < 60) {
      endGame();
    } else {
      animationFrameId = requestAnimationFrame(moveObstacle);
    }
  }

  restartBtn.addEventListener("click", () => {
    isGameStarted = true;
    isPaused = false;
    score = 0;
    obstacleLeft = 1000;
    character.style.bottom = "0px";
    obstacle.style.left = "1000px";
    scoreDisplay.textContent = "$PODS: 0";
    gameOverText.classList.add("hidden");
    restartBtn.classList.add("hidden");
    pauseBtn.disabled = false;
    pauseBtn.textContent = "Pause";
    startRunningAnimation(); // 🆕 resume animation
    moveObstacle();
  });

  // 🆕 Sprite animation (simple 2-frame loop)
  function startRunningAnimation() {
    if (runInterval) clearInterval(runInterval);
    runInterval = setInterval(() => {
      runFrame = (runFrame + 1) % runImages.length;
      if (!isJumping) {
        character.src = runImages[runFrame];
      }
    }, 150); // every 150ms switch frame
  }

  function stopRunningAnimation() {
    clearInterval(runInterval);
  }

  // 🆕 Helper: check if jump sprite exists
  function characterJumpImageExists() {
    const img = new Image();
    img.src = "images/character_jump.png";
    return true; // you can remove this check if always exists
  }
}
