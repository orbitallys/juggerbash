// --- Juggerbash Battle v2 ---
// canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// game state
let gameState = "menu"; // menu, act, fight, enemyTurn, attackBox
let turnCount = 0;

// player stats
let playerHP = 310;
let playerMaxHP = 400;

// enemy stats
let enemyHP = 940;
let enemyMaxHP = 940;

// menu buttons
const buttons = ["FIGHT", "ACT", "ITEM", "MERCY"];
let selectedButton = 0;

// act responses
const actResponses = [
  "The Juggernaut watches you.",
  "He cracks his knuckles.",
  "The Juggernaut adjusts his hat."
];
let actIndex = 0;

// input handling
document.addEventListener("keydown", (e) => {
  if (gameState === "menu") {
    if (e.key === "ArrowRight" || e.key === "d") {
      selectedButton = (selectedButton + 1) % buttons.length;
      playBoop();
    }
    if (e.key === "ArrowLeft" || e.key === "a") {
      selectedButton = (selectedButton - 1 + buttons.length) % buttons.length;
      playBoop();
    }
    if (e.key === "Enter" || e.key === " ") {
      handleMenuSelect();
      playBoop();
    }
  }
});

function handleMenuSelect() {
  if (buttons[selectedButton] === "ACT") {
    gameState = "dialogue";
    turnCount++;
    actIndex = (actIndex + 1) % actResponses.length;
    setTimeout(() => {
      gameState = "enemyTurn";
      startEnemyTurn();
    }, 2000);
  }
  if (buttons[selectedButton] === "FIGHT") {
    enemyHP -= 60;
    if (enemyHP < 0) enemyHP = 0;
    gameState = "dialogue";
    setTimeout(() => {
      gameState = "enemyTurn";
      startEnemyTurn();
    }, 2000);
  }
  if (buttons[selectedButton] === "ITEM") {
    let heal = 50;
    playerHP += heal;
    if (playerHP > playerMaxHP) playerHP = playerMaxHP;
    floatingText.push({text: "+"+heal+" HP!", x: WIDTH/2, y: HEIGHT-140, color: "lime", life: 60});
    gameState = "dialogue";
    setTimeout(() => {
      gameState = "enemyTurn";
      startEnemyTurn();
    }, 2000);
  }
  if (buttons[selectedButton] === "MERCY") {
    gameState = "dialogue";
  }
}

// floating heal/damage text
let floatingText = [];

// boop sound placeholder
function playBoop() {
  console.log("boop");
}

// attack patterns
function startEnemyTurn() {
  gameState = "attackBox";
  currentAttacks = [];
  let pattern = Math.floor(Math.random() * 3);
  if (pattern === 0) spawnSpray();
  if (pattern === 1) spawnRain();
  if (pattern === 2) spawnWave();
  setTimeout(() => {
    gameState = "menu";
  }, 4000);
}

let currentAttacks = [];

function spawnSpray() {
  for (let i=0;i<20;i++) {
    currentAttacks.push({x: WIDTH/2, y: 200, vx: (Math.random()*6-3), vy: 2, r: 5});
  }
}

function spawnRain() {
  for (let i=0;i<15;i++) {
    currentAttacks.push({x: Math.random()*WIDTH, y: 180, vx: 0, vy: 3, r: 5});
  }
}

function spawnWave() {
  for (let i=0;i<20;i++) {
    currentAttacks.push({x: 100+i*20, y: 200, vx: Math.sin(i)*2, vy: 2, r: 5});
  }
}

// render loop
function draw() {
  ctx.clearRect(0,0,WIDTH,HEIGHT);

  // draw juggernaut (placeholder rectangle)
  ctx.fillStyle = "white";
  ctx.fillRect(WIDTH/2-50, 60, 100, 180);

  // dialogue/attack box
  if (gameState === "attackBox") {
    ctx.strokeStyle = "white";
    ctx.strokeRect(WIDTH/2-100, HEIGHT-250, 200, 200);

    // draw projectiles
    ctx.fillStyle = "white";
    currentAttacks.forEach(a => {
      a.x += a.vx;
      a.y += a.vy;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
      ctx.fill();
    });

  } else {
    ctx.strokeStyle = "white";
    ctx.strokeRect(40, HEIGHT-200, WIDTH-80, 120);

    // flavor text
    ctx.fillStyle = "white";
    ctx.font = "16px monospace";
    if (gameState === "dialogue") {
      if (buttons[selectedButton] === "ACT") {
        ctx.fillText(actResponses[actIndex], 60, HEIGHT-160);
      } else if (buttons[selectedButton] === "FIGHT") {
        ctx.fillText("You hit the Juggernaut!", 60, HEIGHT-160);
      } else if (buttons[selectedButton] === "ITEM") {
        ctx.fillText("You used an item!", 60, HEIGHT-160);
      } else {
        ctx.fillText("You spare the Juggernaut...", 60, HEIGHT-160);
      }
    } else {
      ctx.fillText("The Juggernaut watches you.", 60, HEIGHT-160);
    }
  }

  // HP bar
  let hpBoxY = HEIGHT-70;
  ctx.fillStyle = "white";
  ctx.font = "16px monospace";
  ctx.fillText("HP: " + playerHP + "/" + playerMaxHP, 60, hpBoxY);
  ctx.strokeStyle = "white";
  ctx.strokeRect(150, hpBoxY-15, 200, 12);
  ctx.fillStyle = "yellow";
  let hpWidth = 200*(playerHP/playerMaxHP);
  ctx.fillRect(150, hpBoxY-15, hpWidth, 12);

  // floating heal text
  floatingText.forEach((f, i) => {
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    f.y -= 1;
    f.life -= 1;
  });
  floatingText = floatingText.filter(f => f.life > 0);

  // buttons
  let bx = 60;
  buttons.forEach((b, i) => {
    ctx.strokeStyle = (i === selectedButton) ? "yellow" : "orange";
    ctx.strokeRect(bx, HEIGHT-40, 120, 30);
    ctx.fillStyle = "white";
    ctx.fillText(b, bx+40, HEIGHT-20);
    bx += 140;
  });

  requestAnimationFrame(draw);
}
draw();
