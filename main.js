
// Restored Wundo Juggerbash - full feature main.js
const STATE = { MENU: 'menu', STATS: 'stats', GAME: 'game' };
let currentState = STATE.MENU;

// DOM
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
const boopSfx = document.getElementById('boopSfx');
const confirmSfx = document.getElementById('confirmSfx');
const healSfx = document.getElementById('healSfx');
const gameOverSfx = document.getElementById('gameOverSfx');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const dialogueText = document.getElementById('dialogueText');
const enemySprite = document.getElementById('enemySprite');
const actionBtns = Array.from(document.querySelectorAll('.actionBtn'));
const itemRow = document.getElementById('itemRow');
const hpCurEl = document.getElementById('hpCur');
const hpMaxEl = document.getElementById('hpMax');
const hpBar = document.getElementById('hpBar');
const hpLost = document.getElementById('hpLost');

// Stats
let stats = { damage: 0, rounds: 0, deaths: 0 };

// Player & enemy
let player = { hp: 400, maxHp: 400, soulX: 480, soulY: 520, size: 24, alive: true };
let enemy = { hp: 940, maxHp: 940, atk: 120, def: 100, jailed: false };

// Items
let items = {
  LarvaeCookie: {count:1, heal:45},
  GalaNoodles: {count:1, heal:60},
  TheEarnestCake: {count:1, heal:90},
  Mycelium: {count:3, heal:15},
  ClippertonFruitPunch: {count:1, heal:58},
  HoardedSourdough: {count:1, heal:100}
};

// Act sequences stored per-action to show one message per use (advances each time)
let acts = {
  check: {msgs:["HP - 940/940  ATK - 120  DEF - 100. They call him the juggernaut."], idx:0},
  praise: {msgs:[
    "You told the Juggernaut you think he's an excellent writer. His smile curves slightly tighter.",
    "You told the Juggernaut you denounce all worms. A spindly appendage moves inside his coat.",
    "You told the Juggernaut that there is nothing more exciting than a number challenge. The Juggernaut doesn't react.",
    "You told the Juggernaut that he is the juggernaut around these parts. He continues to smile.",
    "You tell the Juggernaut he could lose the fedora and his head would look just as fine. He doesn't seem to understand."
  ], idx:0},
  cry: {msgs:[
    "You begin to tear at the eyes. The Juggernaut sniffles at you.",
    "You start to fake cry. The Juggernaut's ATK has increased!"
  ], idx:0},
  dance: {msgs:[
    "Your left foot starts to tap on the ground. The Juggernaut's face contorts.",
    "You start to hum a song and create a tempo... The Juggernaut moves slightly closer.",
    "You get a charlie horse in your shoulder and stop dancing. The Juggernaut exclaims \"Charlie horse!\"."
  ], idx:0, danceCount:0}
};

// UI state
let selectedIndex = 0; // 0-3 for action buttons
let inAttackSequence = false;
let bullets = [];
let attackPattern = 0;
let floatingMsgs = []; // {text,x,y,color,life}

// Preload soul image (single red)
let soulImg = new Image(); soulImg.src = 'assets/images/soul_red.png';

// Safe audio play helper (catches promises)
function safePlay(audio){
  if(!audio) return;
  try{ const p = audio.play(); if(p && p.catch) p.catch(()=>{}); }catch(e){}
}

// Show/hide screens
function showScreen(s){
  currentState = s;
  menu.classList.toggle('hidden', s !== STATE.MENU);
  statsScreen.classList.toggle('hidden', s !== STATE.STATS);
  gameScreen.classList.toggle('hidden', s !== STATE.GAME);
  if(s === STATE.MENU){ safePlay(menuMusic); battleMusic.pause(); battleMusic.currentTime = 0; }
  if(s === STATE.GAME){ menuMusic.pause(); menuMusic.currentTime = 0; safePlay(battleMusic); }
}

// Menu buttons
startBtn.onclick = ()=>{ confirmSfx.currentTime=0; safePlay(confirmSfx); startGame(); };
statsBtn.onclick = ()=>{ safePlay(boopSfx); openStats(); };
backFromStats.onclick = ()=>{ safePlay(boopSfx); showScreen(STATE.MENU); };

function openStats(){
  statDamage.textContent = stats.damage;
  statRounds.textContent = stats.rounds;
  statDeaths.textContent = stats.deaths;
  showScreen(STATE.STATS);
}

function startGame(){
  // reset for a new run
  player.hp = player.maxHp;
  player.alive = true;
  enemy.hp = enemy.maxHp;
  enemy.jailed = false;
  bullets = [];
  selectedIndex = 0;
  updateHPUI();
  showScreen(STATE.GAME);
  setDialogue("The Juggernaut stares at you. Choose an action.");
  highlightButton(selectedIndex);
}

// Dialogue setter (ensures single flavortext displayed)
let dialogueTimeout = null;
function setDialogue(txt, duration=0){
  dialogueText.textContent = txt;
  if(dialogueTimeout){ clearTimeout(dialogueTimeout); dialogueTimeout = null; }
  if(duration>0) dialogueTimeout = setTimeout(()=>{ dialogueText.textContent=''; dialogueTimeout=null; }, duration);
}

// Update HP UI and show damage overlay effect optionally
let damageOverlay = 0; // percentage of bar to show as red damage
function updateHPUI(showDamageAmount=0){
  hpCurEl.textContent = player.hp;
  hpMaxEl.textContent = player.maxHp;
  const pct = Math.max(0, player.hp / player.maxHp);
  hpBar.style.width = (pct*100) + '%';
  if(showDamageAmount>0){
    // show red overlay on right side representing lost HP temporarily
    const lostPct = Math.min(1, showDamageAmount / player.maxHp);
    hpLost.style.width = (lostPct*100) + '%';
    // animate hide
    hpLost.style.opacity = '0.9';
    setTimeout(()=>{ hpLost.style.opacity='0'; hpLost.style.width='0'; }, 600);
  }
}

// Button highlighting (orange default, yellow when selected)
function highlightButton(idx){
  selectedIndex = idx;
  actionBtns.forEach((b,i)=>{
    b.classList.toggle('selected', i===idx);
  });
  // small boop
  boopSfx.currentTime = 0; safePlay(boopSfx);
}

// Keyboard handling for battle (no prompts)
document.addEventListener('keydown', (e)=>{
  // Global keys
  if(currentState !== STATE.GAME) return;

  // navigation left/right to select action button
  if(e.key === 'ArrowLeft' || e.key === 'a'){ selectedIndex = Math.max(0, selectedIndex-1); highlightButton(selectedIndex); e.preventDefault(); }
  if(e.key === 'ArrowRight' || e.key === 'd'){ selectedIndex = Math.min(actionBtns.length-1, selectedIndex+1); highlightButton(selectedIndex); e.preventDefault(); }

  // confirm action
  if((e.key === 'Enter' || e.key === ' ') && !inAttackSequence){
    // confirm selected button
    const action = actionBtns[selectedIndex].dataset.action;
    safePlay(confirmSfx);
    handleAction(action);
    e.preventDefault();
  }

  // Move soul (only when in attackBox)
  if(inAttackSequence){
    if(e.key === 'w' || e.key === 'ArrowUp') player.soulY = Math.max(player.soulY-12, 0);
    if(e.key === 's' || e.key === 'ArrowDown') player.soulY = Math.min(player.soulY+12, canvas.height);
    if(e.key === 'a' || e.key === 'ArrowLeft') player.soulX = Math.max(player.soulX-12, 0);
    if(e.key === 'd' || e.key === 'ArrowRight') player.soulX = Math.min(player.soulX+12, canvas.width);
  }
});

// Handle actions: fight, act, item, mercy
function handleAction(action){
  if(inAttackSequence) return;
  if(action === 'fight'){ startFightTurn(); }
  if(action === 'act'){ openAct(); }
  if(action === 'item'){ openItemMenu(); }
  if(action === 'mercy'){ setDialogue("You spared the Juggernaut. The Juggernaut has not spared you.", 1200); // doesn't end fight
    // enemy attacks after short delay
    setTimeout(()=>startEnemyAttack(), 700);
  }
}

// Fight: slider mechanic
function startFightTurn(){
  setDialogue("You prepare to fight. Hit Space to stop the slider for max damage.", 0);
  // slider overlay variables
  let sliderRunning = true;
  const slider = {x: 220, y: 420, w: 520, h: 28};
  let pos = 0, dir = 1;
  // draw loop temporarily until stopped; we will use event listener
  function sliderDraw(){
    // draw overlay on canvas area (we'll keep canvas drawing running separately; slider draw uses DOM overlay? use simple approach: set a temporary flag and render in main loop)
    if(sliderRunning) requestAnimationFrame(sliderDraw);
  }
  sliderRunning = true;
  // listen for space to stop
  function stopHandler(e){
    if(e.code === 'Space' || e.key === ' ' || e.key === 'Enter'){
      document.removeEventListener('keydown', stopHandler);
      sliderRunning = false;
      // compute dmg based on pos
      const center = (slider.w-8)/2;
      const dist = Math.abs(pos-center);
      const dmg = (dist <= 18) ? 20 : 7;
      // apply damage
      enemy.hp = Math.max(0, enemy.hp - dmg);
      stats.damage += dmg;
      hitSfx.currentTime = 0; safePlay(hitSfx);
      updateHPUI(0);
      setDialogue(`You dealt ${dmg} damage!`, 800);
      if(enemy.hp <= 0){
        enemyDead();
        return;
      }
      // proceed to enemy attack after short delay
      setTimeout(()=>{ startEnemyAttack(); }, 700);
    }
  }
  // animate slider position on interval
  let sliderInterval = setInterval(()=>{
    pos += dir*6;
    if(pos <= 0){ pos = 0; dir = 1; }
    if(pos >= slider.w-8){ pos = slider.w-8; dir = -1; }
  }, 16);

  // attach stop handler
  document.addEventListener('keydown', stopHandler);

  // Stop and cleanup when function finishes (enemy attack or enemy death will clear)
  // To render slider we use the main canvas loop which checks a global sliderActive flag and slider state
  window.sliderActive = true;
  window.sliderState = {x: slider.x, y: slider.y, w: slider.w, h: slider.h, pos: ()=>pos};
  // after it's done, clear interval eventually when sliderActive cleared by enemy or after some time
  const sliderStopChecker = setInterval(()=>{
    if(!window.sliderActive){ clearInterval(sliderInterval); clearInterval(sliderStopChecker); }
  }, 100);
}

// Enemy death handling
function enemyDead(){
  enemy.jailed = true;
  enemy.hp = 0;
  enemySprite.src = 'assets/images/juggernaut_jailed.png';
  setDialogue("The Juggernaut is defeated. It appears subdued.", 2000);
  // stop battle music after short delay
  setTimeout(()=>{ battleMusic.pause(); battleMusic.currentTime=0; showScreen(STATE.MENU); }, 1800);
}

// Act handling: show one message per action type per use (advances index)
function openAct(){
  // show a small act sub-menu inline controlled by selectedIndex cycling to subchoices (we'll map keys 1-4 to sub-actions via left/right then confirm)
  // For simplicity: pressing ACT will auto-open Check (use "check" by default), but user wanted manual control via soul; to respect that we advance the "praise/cry/dance/check" cycles by using selectedIndex of sub-actions
  // We'll implement a simple cycle: each time player selects ACT, we show the next message in a focused act type sequence (Praise chosen sequentially by pressing ACT repeatedly toggling type)
  // Simpler: Present a small in-dialogue list navigable with left/right (A/D) before confirming with Enter; But user asked no prompts so use the selected button to be ACT and then open a temporary sub-selection.
  const subActions = ['check','praise','cry','dance'];
  // Open sub-selection UI
  let subIndex = 0;
  setDialogue(`Choose Act: ${subActions.join(' / ')} (use ← → then Enter)`, 0);
  // temporary listener
  function subKey(e){
    if(e.key === 'ArrowLeft' || e.key === 'a'){ subIndex = (subIndex-1+subActions.length)%subActions.length; setDialogue(`Act: ${subActions[subIndex]}`); safePlay(boopSfx); }
    if(e.key === 'ArrowRight' || e.key === 'd'){ subIndex = (subIndex+1)%subActions.length; setDialogue(`Act: ${subActions[subIndex]}`); safePlay(boopSfx); }
    if(e.key === 'Enter' || e.key === ' '){
      // confirm chosen act
      document.removeEventListener('keydown', subKey);
      safePlay(confirmSfx);
      const chosen = subActions[subIndex];
      // display the next message from that act's sequence
      if(chosen === 'check'){
        const msg = acts.check.msgs[0];
        setDialogue(msg, 900);
      } else if(chosen === 'praise'){
        const a = acts.praise; setDialogue(a.msgs[a.idx], 900); a.idx = Math.min(a.idx+1, a.msgs.length-1);
      } else if(chosen === 'cry'){
        const a = acts.cry; setDialogue(a.msgs[a.idx], 900); a.idx = Math.min(a.idx+1, a.msgs.length-1);
      } else if(chosen === 'dance'){
        const a = acts.dance; setDialogue(a.msgs[Math.min(a.idx, a.msgs.length-1)], 900); a.danceCount = (a.danceCount||0)+1; a.idx = Math.min(a.idx+1, a.msgs.length-1);
        if(a.danceCount >= 15){ setDialogue("You begin performing a festive jig. The Juggernaut smirks and compliments your festive jig.", 1200); }
      }
      // after act, enemy attacks
      setTimeout(()=>startEnemyAttack(), 700);
    }
  }
  document.addEventListener('keydown', subKey);
}

// Item menu: show items and allow keyboard selection via left/right then confirm
function openItemMenu(){
  // build itemRow
  itemRow.innerHTML = '';
  const keys = Object.keys(items);
  keys.forEach((k, i)=>{
    const cell = document.createElement('div'); cell.className='itemCell';
    cell.dataset.key = k;
    cell.innerHTML = `<div style="font-size:11px">${k}</div><div style="font-size:11px">x${items[k].count}</div><div style="font-size:11px">+${items[k].heal}HP</div>`;
    if(i===0) cell.style.outline='2px solid yellow';
    itemRow.appendChild(cell);
  });
  itemRow.classList.remove('hidden');
  // selection
  let sel = 0; const max = keys.length;
  function updateSelection(){ Array.from(itemRow.children).forEach((c,idx)=>{ c.style.outline = (idx===sel)?'2px solid yellow':'2px solid #444'; }); safePlay(boopSfx); }
  function confirmHandler(e){
    if(e.key === 'ArrowLeft' || e.key === 'a'){ sel = (sel-1+max)%max; updateSelection(); }
    if(e.key === 'ArrowRight' || e.key === 'd'){ sel = (sel+1)%max; updateSelection(); }
    if(e.key === 'Enter' || e.key === ' '){
      document.removeEventListener('keydown', confirmHandler);
      const key = keys[sel];
      if(items[key].count <= 0){ setDialogue("You don't have that item.", 900); itemRow.classList.add('hidden'); setTimeout(()=>startEnemyAttack(),700); return; }
      items[key].count -= 1;
      player.hp = Math.min(player.maxHp, player.hp + items[key].heal);
      updateHPUI();
      floatingMsgs.push({text:`+${items[key].heal} HP!`, x: 520, y: 540, color:'lime', life:80});
      healSfx.currentTime = 0; safePlay(healSfx);
      itemRow.classList.add('hidden');
      setTimeout(()=>startEnemyAttack(),700);
    }
    if(e.key === 'Escape'){ document.removeEventListener('keydown', confirmHandler); itemRow.classList.add('hidden'); setDialogue("You checked your pockets.", 600); setTimeout(()=>startEnemyAttack(),700); }
  }
  document.addEventListener('keydown', confirmHandler);
}

// Enemy attack patterns: 3 types, bullets white, soul used to dodge inside attack box
function startEnemyAttack(){
  // set attack box state for main loop
  inAttackSequence = true;
  bullets = [];
  // pick random pattern
  const p = Math.floor(Math.random()*3);
  attackPattern = p;
  if(p===0){ // spray from top center
    for(let i=0;i<22;i++){ const angle = (Math.random()*1.6)-0.8; const speed=2+Math.random()*2; bullets.push({x:480,y:120,vx:Math.sin(angle)*speed,vy:Math.cos(angle)*speed,r:6}); }
  } else if(p===1){ // rain
    for(let i=0;i<18;i++){ bullets.push({x:Math.random()*880 + 40, y:-20 + Math.random()*40, vx:0, vy:3 + Math.random()*1.5, r:5}); }
  } else { // spiral
    const cx = 480, cy=120;
    for(let i=0;i<26;i++){ const a = i*0.3; const speed = 1.8 + (i%5)*0.2; bullets.push({x:cx + Math.cos(a)*8, y:cy + Math.sin(a)*8, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, r:5}); }
  }
  // play attack sfx
  attackSfx.currentTime = 0; safePlay(attackSfx);
  // after duration end, clear and return to choose actions
  setTimeout(()=>{ inAttackSequence = false; bullets = []; stats.rounds += 1; setDialogue("Choose an action."); highlightButton(0); }, 2800);
}

// collision detection and damage application handled in main loop update
function applyBulletHits(){
  for(let i=0;i<bullets.length;i++){
    const b = bullets[i];
    const dx = b.x - player.soulX;
    const dy = b.y - player.soulY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist < b.r + player.size/2){
      // hit
      bullets.splice(i,1); i--;
      const dmg = 30;
      player.hp = Math.max(0, player.hp - dmg);
      floatingMsgs.push({text:`-${dmg}`, x: player.soulX, y: player.soulY - 20, color:'crimson', life:90});
      hitSfx.currentTime = 0; safePlay(hitSfx);
      updateHPUI(dmg);
      if(player.hp <= 0){ // death
        stats.deaths += 1;
        gameOverSfx.currentTime = 0; safePlay(gameOverSfx);
        setDialogue("You died. Game over.", 1200);
        setTimeout(()=>{ showScreen(STATE.MENU); }, 1200);
      }
    }
  }
}

// Enemy damage noise visual: red overlay managed in updateHPUI by hpLost bar

// Main animation loop for canvas rendering
let last = performance.now();
function mainLoop(ts){
  const dt = (ts-last)/16.67; last = ts;
  // clear
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // draw enemy top center (DOM image displayed over canvas in UI, so canvas can leave space)
  // draw a faint arena rectangle
  ctx.fillStyle = '#111'; ctx.fillRect(160,20,640,240);
  // draw bullets if in attack
  if(inAttackSequence){
    ctx.fillStyle = '#fff';
    for(let b of bullets){
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    }
    applyBulletHits();
  }
  // draw soul (player) - when not in attack sequence soul is shown near action area as selector; during attack it moves in attack box
  ctx.save();
  ctx.drawImage(soulImg, player.soulX - player.size/2, player.soulY - player.size/2, player.size, player.size);
  ctx.restore();
  // draw HP UI overlay (we use DOM for HP bar, but draw small indicator on canvas too)
  // floating messages
  for(let i=floatingMsgs.length-1;i>=0;i--){
    const f = floatingMsgs[i];
    ctx.fillStyle = f.color;
    ctx.font = "14px 'Press Start 2P', monospace";
    ctx.fillText(f.text, f.x, f.y);
    f.y -= 0.6 * dt;
    f.life -= 1;
    if(f.life <= 0) floatingMsgs.splice(i,1);
  }
  // slider overlay drawing if active
  if(window.sliderActive && window.sliderState){
    const s = window.sliderState;
    const pos = s.pos();
    // darken area
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(s.x-40, s.y-40, s.w+80, s.h+80);
    // outline and slider
    ctx.strokeStyle = '#fff'; ctx.strokeRect(s.x, s.y-20, s.w, s.h+40);
    // slider background
    ctx.fillStyle = '#222'; ctx.fillRect(s.x+30, s.y+10, s.w-60, s.h);
    // center target
    const centerX = s.x+30 + (s.w-60)/2;
    ctx.fillStyle = '#333'; ctx.fillRect(centerX-18, s.y+10, 36, s.h);
    // moving bar
    ctx.fillStyle = '#fff'; ctx.fillRect(s.x+30+pos, s.y+10, 8, s.h);
  }

  requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);

// initialize menu music on first interaction (some browsers block autoplay)
document.addEventListener('keydown', function initMusicOnce(){
  safePlay(menuMusic);
  document.removeEventListener('keydown', initMusicOnce);
});

// helpers for starting the game etc.
function updateHPUIImmediate(){
  hpCurEl.textContent = player.hp;
  hpMaxEl.textContent = player.maxHp;
  const pct = Math.max(0, player.hp / player.maxHp);
  hpBar.style.width = (pct*100) + '%';
}
function updateHPUI(showDamage=0){ updateHPUIImmediate(); if(showDamage>0){ hpLost.style.width = Math.min(100,(showDamage/player.maxHp)*100) + '%'; hpLost.style.opacity='0.9'; setTimeout(()=>{ hpLost.style.opacity='0'; hpLost.style.width='0'; },600); } }

// Initial display
showScreen(STATE.MENU);
