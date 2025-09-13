
// Wundo Juggerbash - simplified Undertale-like fight system
const STATE = {
  menu: 'menu',
  game: 'game',
  act: 'act',
  fight: 'fight',
  item: 'item',
  mercy: 'mercy',
  attack: 'attackSequence'
};

let currentState = STATE.menu;
let stats = {damage:0, rounds:0, deaths:0};
let player = {hp:400, maxHp:400, soulX:460, soulY:420, size:24, alive:true};
let enemy = {hp:940, atk:120, def:100, maxHp:940, jailed:false};
let items = {
  'LarvaeCookie': {count:1, heal:45},
  'GalaNoodles': {count:1, heal:60},
  'TheEarnestCake': {count:1, heal:90},
  'Mycelium': {count:3, heal:15},
  'ClippertonFruitPunch': {count:1, heal:58},
  'HoardedSourdough': {count:1, heal:100}
};

const menu = document.getElementById('menu');
const statsScreen = document.getElementById('stats');
const gameScreen = document.getElementById('game');
const startBtn = document.getElementById('startBtn');
const statsBtn = document.getElementById('statsBtn');
const backFromStats = document.getElementById('backFromStats');
const statDamage = document.getElementById('statDamage');
const statRounds = document.getElementById('statRounds');
const statDeaths = document.getElementById('statDeaths');
const menuMusic = document.getElementById('menuMusic');
const battleMusic = document.getElementById('battleMusic');
const attackSfx = document.getElementById('attackSfx');
const hitSfx = document.getElementById('hitSfx');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const dialogueBox = document.getElementById('dialogueBox');
const dialogueText = document.getElementById('dialogueText');
const enemySprite = document.getElementById('enemySprite');
const actionBtns = Array.from(document.querySelectorAll('.actionBtn'));

let selectedIndex = 0;
let soulImgRed = new Image(); soulImgRed.src = 'assets/images/soul_red.png';
let soulImgYellow = new Image(); soulImgYellow.src = 'assets/images/soul_yellow.png';
let soulIsYellow = false;

let bullets = [];
let attackPhase = 0;
let waveInProgress = false;
let roundsSurvivedThisRun = 0;
let inAttackSequence = false;

function showScreen(s){
  currentState = s;
  menu.classList.toggle('hidden', s !== STATE.menu);
  statsScreen.classList.toggle('hidden', s !== 'statsScreen' && s !== 'stats');
  gameScreen.classList.toggle('hidden', s !== STATE.game);
  if(s === STATE.menu){ menuMusic.play(); battleMusic.pause(); battleMusic.currentTime=0; }
  if(s === STATE.game){ menuMusic.pause(); battleMusic.play(); }
}

startBtn.onclick = ()=>{ startGame(); };
statsBtn.onclick = ()=>{ openStats(); };
backFromStats.onclick = ()=>{ showScreen(STATE.menu); };

function openStats(){
  statDamage.textContent = stats.damage;
  statRounds.textContent = stats.rounds;
  statDeaths.textContent = stats.deaths;
  showScreen('stats');
}

function startGame(){
  // reset for a new run
  player.hp = player.maxHp;
  player.alive = true;
  enemy.hp = enemy.maxHp;
  enemy.jailed = false;
  bullets = [];
  roundsSurvivedThisRun = 0;
  showScreen(STATE.game);
  setDialogue("The Juggernaut stares at you. Choose an action.");
  highlightButton(selectedIndex);
}

function setDialogue(txt){
  dialogueText.textContent = txt;
}

function highlightButton(idx){
  selectedIndex = idx;
  actionBtns.forEach((b,i)=>{
    b.classList.toggle('selected', i===idx);
  });
  soulIsYellow = false;
}

actionBtns.forEach((b, i)=>{
  b.onclick = ()=>{ doAction(b.dataset.action); };
});

document.addEventListener('keydown', (e)=>{
  if(currentState !== STATE.game) return;
  if(e.key === 'ArrowLeft') { selectedIndex = Math.max(0, selectedIndex-1); highlightButton(selectedIndex); }
  if(e.key === 'ArrowRight') { selectedIndex = Math.min(actionBtns.length-1, selectedIndex+1); highlightButton(selectedIndex); }
  if(e.key === 'Enter' || e.key === ' ') { // activate selected
    const action = actionBtns[selectedIndex].dataset.action;
    doAction(action);
  }
  // move soul
  if(e.key === 'w' || e.key === 'ArrowUp') player.soulY -= 12;
  if(e.key === 's' || e.key === 'ArrowDown') player.soulY += 12;
  if(e.key === 'a' || e.key === 'ArrowLeft') player.soulX -= 12;
  if(e.key === 'd' || e.key === 'ArrowRight') player.soulX += 12;
});

function doAction(action){
  if(inAttackSequence) return;
  if(action === 'fight') startFightTurn();
  if(action === 'act') openActMenu();
  if(action === 'item') openItemMenu();
  if(action === 'mercy') doMercy();
}

function startFightTurn(){
  setDialogue("You prepare to fight. Press Space during the slider for max damage.");
  currentState = STATE.fight;
  // show attack slider overlay
  showSlider().then(dmg=>{
    attackSfx.play();
    enemy.hp -= dmg;
    stats.damage += dmg;
    hitSfx.play();
    if(enemy.hp <= 0){
      enemy.hp = 0;
      enemy.jailed = true;
      enemySprite.src = 'assets/images/juggernaut_jailed.png';
      setDialogue("The Juggernaut is defeated. It appears subdued.");
      // end run: update stats rounds
      stats.rounds += roundsSurvivedThisRun;
      return;
    }
    // proceed to enemy attack wave
    setTimeout(()=>{ startEnemyAttack(); }, 700);
  });
}

// slider UI using promise
function showSlider(){
  return new Promise(resolve=>{
    const sliderW = 520;
    const sliderH = 28;
    let pos = 0;
    let dir = 1;
    let running = true;
    const draw = ()=>{
      // draw overlay on canvas top area
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(120,380,520,60);
      ctx.strokeStyle = '#fff'; ctx.strokeRect(120,380,520,60);
      // slider background
      ctx.fillStyle = '#222'; ctx.fillRect(150,400,sliderW,sliderH);
      // target center zone
      const centerX = 150 + sliderW/2;
      ctx.fillStyle = '#333'; ctx.fillRect(centerX-18,400,36,sliderH);
      // moving bar
      ctx.fillStyle = '#fff'; ctx.fillRect(150+pos,400,8,sliderH);
      if(running) requestAnimationFrame(draw);
    };
    const loop = ()=>{
      pos += dir*6;
      if(pos <= 0){ pos=0; dir=1; }
      if(pos >= sliderW-8){ pos = sliderW-8; dir=-1; }
    };
    const interval = setInterval(loop,16);
    draw();
    function stop(){
      clearInterval(interval);
      running=false;
      // compute distance from center
      const center = (sliderW-8)/2;
      const dist = Math.abs(pos-center);
      // if within 18px -> full damage 20 else 7
      const dmg = dist <= 18 ? 20 : 7;
      // clear overlay area after short delay
      setTimeout(()=>{ clearSliderArea(); resolve(dmg); }, 80);
    }
    function keyHandler(e){
      if(e.code === 'Space' || e.key === ' ' || e.key === 'Enter'){ document.removeEventListener('keydown', keyHandler); stop(); }
    }
    document.addEventListener('keydown', keyHandler);
  });
}

function clearSliderArea(){
  ctx.clearRect(120,360,520,100);
}

function startEnemyAttack(){
  inAttackSequence = true;
  waveInProgress = true;
  bullets = [];
  roundsSurvivedThisRun += 1;
  // spawn bullets outward toward soul area (simple spray)
  const centerX = 480, centerY = 80;
  const count = 18;
  for(let i=0;i<count;i++){
    const angle = (Math.PI*2)*(i/count) + (Math.random()*0.6 - 0.3);
    const speed = 2 + Math.random()*2;
    bullets.push({x:centerX,y:centerY,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:6});
  }
  setDialogue("The Juggernaut attacks!");
  // attack duration
  setTimeout(()=>{
    waveInProgress = false;
    inAttackSequence = false;
    // after attack, return to choose action if player alive
    if(player.hp>0){
      setDialogue("Choose an action.");
      highlightButton(0);
    }
    // increment rounds survived to global stats if survived whole wave
    stats.rounds += 1;
  }, 2600);
}

function openActMenu(){
  // simplified act menu using prompt-like sequence in dialogue box
  // We'll emulate sequential messages for Praise/Cry/Dance/Check
  setDialogue("ACT: Check, Praise, Cry, Dance. Click an action below (or press 1-4).");
  // use browser prompts for simplicity or custom mini-menu
  const choice = prompt("Act: type 'check','praise','cry','dance'").toLowerCase();
  if(choice === 'check'){
    setDialogue(`HP - ${enemy.hp}/${enemy.maxHp}  ATK - ${enemy.atk}  DEF - ${enemy.def}. They call him the juggernaut.`);
  } else if(choice === 'praise'){
    // sequence of five messages
    const msgs = [
      "You told the Juggernaut you think he's an excellent writer. His smile curves slightly tighter.",
      "You told the Juggernaut you denounce all worms. A spindly appendage moves inside his coat.",
      "You told the Juggernaut that there is nothing more exciting than a number challenge. The Juggernaut doesn't react.",
      "You told the Juggernaut that he is the juggernaut around these parts. He continues to smile.",
      "You tell the Juggernaut he could lose the fedora and his head would look just as fine. He doesn't seem to understand."
    ];
    let i=0;
    const interval = setInterval(()=>{
      setDialogue(msgs[i]); i++;
      if(i>=msgs.length){ clearInterval(interval); }
    },900);
  } else if(choice === 'cry'){
    const msgs = [
      "You begin to tear at the eyes. The Juggernaut sniffles at you.",
      "You start to fake cry. The Juggernaut's ATK has increased!"
    ];
    let i=0;
    const interval = setInterval(()=>{
      setDialogue(msgs[i]); i++;
      if(i>=msgs.length){ clearInterval(interval); }
    },900);
  } else if(choice === 'dance'){
    const msgs = [
      "Your left foot starts to tap on the ground. The Juggernaut's face contorts.",
      "You start to hum a song and create a tempo by snapping your fingers, while gently shuffling your shoulders. The Juggernaut moves slightly closer.",
      "You get a charlie horse in your shoulder and stop dancing. The Juggernaut exclaims \"Charlie horse!\"."
    ];
    let i=0;
    const interval = setInterval(()=>{
      setDialogue(msgs[i]); i++;
      if(i>=msgs.length){ clearInterval(interval); }
    },900);
    // if danced 15 times something special; keep a counter
    window.danceCount = (window.danceCount||0)+1;
    if(window.danceCount>=15){
      setTimeout(()=> setDialogue("You begin performing a festive jig. The Juggernaut smirks and compliments your festive jig."), 2000);
    }
  } else {
    setDialogue("You hesitate.");
  }
}

function openItemMenu(){
  // simple item selection via prompt showing counts
  let list = "Items:\n";
  let idx=1;
  for(const k in items){ list += `${idx}. ${k} x${items[k].count} (heals ${items[k].heal})\n`; idx++; }
  list += "Type the item name to eat it.";
  const choice = prompt(list);
  if(!choice) return setDialogue("You did not use an item.");
  const key = Object.keys(items).find(k=>k.toLowerCase()===choice.toLowerCase());
  if(!key) return setDialogue("No such item.");
  if(items[key].count<=0) return setDialogue("You don't have any left.");
  player.hp = Math.min(player.maxHp, player.hp + items[key].heal);
  items[key].count -= 1;
  setDialogue(`You ate the ${key}! You healed ${items[key].heal} HP!`);
}

function doMercy(){
  setDialogue("You spared the Juggernaut. The Juggernaut has not spared you.");
  // mercy does not end fight
}

// Update loop
function update(dt){
  // move bullets
  if(bullets.length>0){
    for(let b of bullets){
      b.x += b.vx*dt;
      b.y += b.vy*dt;
      // collision with soul
      const dx = b.x - player.soulX;
      const dy = b.y - player.soulY;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if(dist < b.r + player.size/2){
        // hit
        player.hp -= 30;
        // remove bullet by marking offscreen
        b.x = -1000;
        if(player.hp <= 0){
          player.hp = 0; player.alive=false;
          stats.deaths += 1;
          setDialogue("You died. Game over. Press OK to continue.");
          alert("You died! Game over. Starting a new run.");
          startGame();
          return;
        }
      }
    }
    // filter offscreen
    bullets = bullets.filter(b=>b.x>=-50 && b.x<=canvas.width+50 && b.y>=-50 && b.y<=canvas.height+50);
  }
  // simple enemy behavior: occasionally show flavor
  if(Math.random() < 0.002){
    setDialogue("The Juggernaut's arm gently pulls the left side of his coat closer.");
  }
}

let last = performance.now();
function loop(ts){
  const dt = (ts-last)/16.67; last = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function render(){
  // clear
  ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // draw enemy area top center
  ctx.fillStyle='#222'; ctx.fillRect(260,20,440,160);
  // draw bullets
  for(let b of bullets){
    ctx.beginPath(); ctx.fillStyle='#f00'; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
  }
  // draw soul (player) as image centered at player.soulX/Y
  const soul = soulIsYellow ? soulImgYellow : soulImgRed;
  ctx.drawImage(soul, player.soulX - player.size/2, player.soulY - player.size/2, player.size, player.size);
  // draw HP UI bottom left
  ctx.fillStyle='#111'; ctx.fillRect(20,440,260,80);
  ctx.strokeStyle='#fff'; ctx.strokeRect(20,440,260,80);
  ctx.fillStyle='#fff'; ctx.font='12px "Press Start 2P"'; ctx.fillText(`HP: ${player.hp}/${player.maxHp}`,28,468);
  ctx.fillText(`Enemy HP: ${enemy.hp}/${enemy.maxHp}`,28,492);
  // draw enemy sprite - kept in DOM over canvas so not drawn here
}

// start loop
requestAnimationFrame(loop);
