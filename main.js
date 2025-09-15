// main.js — patched for main-menu fixes and Juggernaut battle updates
// - Battle box half-size (260px)
// - Juggernaut picks one pattern and repeats it 3-5 times (same pattern)
// - Projectiles cleared only after the whole attack finishes
// - Attacks spawn around the dialogue/battle box (left/right/top/corners)
// - Soul centered and still movable; action buttons disabled during attack
// - New attack types: proj_juggernautface, proj_foolscoin, proj_fist, proj_bullet
// - Warning visuals are static red shapes (no blinking) as requested

// -------------------- Config --------------------
const NAV_COOLDOWN_MS = 140;
const SLIDER_CENTER_HIT_RADIUS = 18;
const ATTACK_REPEAT_DEFAULT = 3;
const ATTACK_REPEAT_GAP_MS = 600;
const DEFAULT_DIALOGUE_POST_DELAY = 220; // ms after dialogue finishes before next action

// -------------------- DOM refs --------------------
const $ = id => document.getElementById(id);
const menu = $('menu');
const statsScreen = $('stats');
const gameScreen = $('game');
const startBtn = $('startBtn');
const statsBtn = $('statsBtn');
const backFromStats = $('backFromStats');

const menuMusic = $('menuMusic');
const battleMusic = $('battleMusic');
const boopSfx = $('boopSfx');
const confirmSfx = $('confirmSfx');
const healSfx = $('healSfx');
const tickSfx = $('tickSfx');
const attackSfx = $('attackSfx');
const hitSfx = $('hitSfx');

// New audio nodes (ensure these exist in your HTML with these IDs or update to the right IDs)
const jugatk1Sfx = $('jugatk1') || null; // jugatk1.wav - face spray
const jugatk2Sfx = $('jugatk2') || null; // jugatk2.wav - foolscoin/fist/bullet

const canvas = $('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const dialogueBox = $('dialogueBox');
const dialogueText = $('dialogueText');
const choiceGrid = $('choiceGrid') || createChoiceGrid();
const sliderWrap = $('sliderWrap');
const sliderCanvas = $('sliderCanvas');
const sliderCtx = sliderCanvas ? sliderCanvas.getContext('2d') : null;
const actionBtns = Array.from(document.querySelectorAll('.actionBtn'));
const hpCur = $('hpCur');
const hpMax = $('hpMax');
const hpBar = $('hpBar');
const hpLost = $('hpLost');
let soul = $('soul');
let soulMenu = $('soulMenu'); // static decorative soul above menu
let enemySprite = $('enemySprite');
const enemyHpBar = $('enemyHpBar'); // expected fill element
let enemyHpDamaged = $('enemyHpDamaged'); // lag overlay (created if missing)
const projectileLayer = $('projectileLayer') || createProjectileLayer();

// -------------------- Game data --------------------
let state = 'menu'; // 'menu' | 'stats' | 'game'
let stats = { damage: 0, rounds: 0, deaths: 0 };
let player = { hp: 400, maxHp: 400, soulX: 480, soulY: 520, size: 24 };
let enemy = { hp: 940, maxHp: 940, atk: 120, def: 100, jailed: false };

let items = {
  LarvaeCookie: { count: 1, heal: 45 },
  GalaNoodles: { count: 1, heal: 60 },
  TheEarnestCake: { count: 1, heal: 90 },
  Mycelium: { count: 3, heal: 15 },
  ClippertonFruitPunch: { count: 1, heal: 58 },
  HoardedSourdough: { count: 1, heal: 100 }
};

let acts = {
  check: { msgs: ["HP - 940/940  ATK - 120  DEF - 100. They call him the Juggernaut."], idx: 0 },
  praise: { msgs: [
      "You told the Juggernaut you think he's an excellent writer. His smile curves slightly tighter.",
      "You told the Juggernaut you denounce all worms. A spindly appendage moves inside his coat.",
      "You told the Juggernaut that there is nothing more exciting than a number challenge. The Juggernaut doesn't react.",
      "You told the Juggernaut that he is the juggernaut around these parts. He continues to smile.",
      "You tell the Juggernaut he could lose the fedora and his head would look just as fine. He doesn't seem to understand."
    ], idx: 0 },
  cry: { msgs: ["You begin to tear at the eyes. The Juggernaut sniffles at you.", "You start to fake cry. The Juggernaut's ATK has increased!"], idx: 0 },
  dance: { msgs: [
      "Your left foot starts to tap on the ground. The Juggernaut's face contorts.",
      "You start to hum a song and create a tempo... The Juggernaut moves slightly closer.",
      "You get a charlie horse in your shoulder and stop dancing. The Juggernaut exclaims \"Charlie horse!\"."
    ], idx: 0, danceCount: 0 }
};

// -------------------- Juggernaut flavor config --------------------
const JUGGERNAUT_FLAVORS = [
  "The Juggernaut stands impressively.",
  "They call him the Juggernaut around these parts.",
  "The air crackles with glory and juice.",
  "Don't let our losses paint us sore! Fathead for Vice-Chairman and CEO of Clipperton Hinges and Axels Department!",
  "Don't listen to the fat one. Family Dog doesn't settle for less.",
  "The air crackles with babas.",
  "The Juggernaut's looms closer."
];

const JUGGERNAUT_LEMON_SEQ = [
  "The Juggernaut juggles a lemon in his hand.",
  "The Juggernaut dropped the lemon from his hand.",
  "They don't call him the juggler around these parts."
];

const JUGGERNAUT_INVITE = "The Juggernaut invites you to surrender.";

// runtime flavor state
let juggernautTurnCount = 0;     // counts turns (increments just after an enemy attack ends; startGame sets to 0)
let juggernautLastFlavor = null; // stored flavor to repeat (per your request)
let juggernautRepeatLast = true; // when true, repeat juggernautLastFlavor each turn until special 24-turn action

// -------------------- Runtime state --------------------
let menuIndex = 0;
let keysDown = {};
let playerTurn = true;
let inSlider = false;
let inChoiceMode = false;
let currentChoices = [];
let actionIndex = 0;
let bullets = []; // stores projectile objects OR floating text objects {isText:true}
let inAttack = false;
let lastDialogText = ''; // store last dialog for restore

// slider
let slider = {
  pos: 0, dir: 1, w: sliderCanvas ? sliderCanvas.width - 60 : 360,
  active: false, duration: 3500, speed: 6
};

// safe timers and wrappers
let safeIntervals = [], safeTimeouts = [];
function safeSetInterval(fn, ms){ const id = setInterval(fn, ms); safeIntervals.push(id); return id; }
function safeClearIntervals(){ safeIntervals.forEach(clearInterval); safeIntervals = []; }
function safeSetTimeout(fn, ms){ const id = setTimeout(fn, ms); safeTimeouts.push(id); return id; }
function safeClearTimeouts(){ safeTimeouts.forEach(clearTimeout); safeTimeouts = []; }
function safePlay(audio){ if(!audio) return; try{ const p = audio.play(); if(p && p.catch) p.catch(()=>{}); }catch(e){} }

// -------------------- Small DOM helpers --------------------
function createProjectileLayer(){
  const d = document.createElement('div'); d.id='projectileLayer';
  d.style.position='absolute'; d.style.left='0'; d.style.top='0'; d.style.width='100%'; d.style.height='100%';
  d.style.pointerEvents='none'; d.style.zIndex='9000'; document.body.appendChild(d); return d;
}
function createChoiceGrid(){
  const d = document.createElement('div'); d.id='choiceGrid'; if(dialogueBox) dialogueBox.appendChild(d); else document.body.appendChild(d); return d;
}
function ensureEnemyHpDamaged(){
  if (!enemyHpDamaged) {
    enemyHpDamaged = document.createElement('div');
    enemyHpDamaged.id = 'enemyHpDamaged';
    enemyHpDamaged.style.position = 'absolute';
    enemyHpDamaged.style.height = '12px';
    enemyHpDamaged.style.background = 'crimson';
    enemyHpDamaged.style.zIndex = 8999;
    if (enemyHpBar && enemyHpBar.parentElement) enemyHpBar.parentElement.appendChild(enemyHpDamaged); else document.body.appendChild(enemyHpDamaged);
  }
}

// -------------------- Nav debounce --------------------
let lastNavTime = 0;
function canNavigate(){
  const now = performance.now();
  if (now - lastNavTime < NAV_COOLDOWN_MS) return false;
  lastNavTime = now;
  return true;
}

// -------------------- Cleanup on death/menu --------------------
function cleanupOnDeath(){
  safeClearIntervals(); safeClearTimeouts();
  [menuMusic, battleMusic, boopSfx, confirmSfx, healSfx, tickSfx, attackSfx, hitSfx, jugatk1Sfx, jugatk2Sfx].forEach(a => { if(!a) return; try{ a.pause(); a.currentTime = 0; }catch(e){} });
  // remove projectile DOMs
  document.querySelectorAll('.proj-sprite').forEach(n => n.remove());
  bullets = bullets.filter(b => b.isText); // keep floating text if needed
  if (choiceGrid) choiceGrid.innerHTML = '';
  if (dialogueText) dialogueText.textContent = '';
  if (soul) soul.style.display = 'none';
  if (soulMenu) soulMenu.style.display = 'none';
  // hide boss hp
  hideBossHpBar();
}

// -------------------- Soul positioning & gliding --------------------
// ensure 'soul' exists and is positioned properly. If HTML provides an <img id="soul"> it will be used.
(function ensureSoul(){
  if (!soul) {
    soul = document.createElement('img');
    soul.id = 'soul';
    soul.src = 'assets/images/soul_red.png';
    soul.style.width = '24px'; soul.style.height = '24px';
    document.body.appendChild(soul);
  }
  soul.style.position = 'absolute';
  soul.style.zIndex = 99999;
  soul.style.pointerEvents = 'none';
  if (soul.parentElement !== document.body) document.body.appendChild(soul);

  // ensure decorative menu sprite exists (from HTML) but if not, create a fallback img
  if (!soulMenu) {
    soulMenu = document.createElement('img');
    soulMenu.id = 'soulMenu';
    soulMenu.src = 'assets/images/soul_red.png';
    soulMenu.style.width = '24px'; soulMenu.style.height = '24px';
    soulMenu.style.position = 'absolute';
    soulMenu.style.zIndex = 99990;
    document.body.appendChild(soulMenu);
  }
  soulMenu.style.position = 'absolute';
  soulMenu.style.pointerEvents = 'none';
  soulMenu.style.imageRendering = 'pixelated';
  if (soulMenu.parentElement !== document.body) document.body.appendChild(soulMenu);
})();
let soulTarget = { x:null, y:null, active:false };
function moveSoulToElement(el, instant=false){
  if (!el || !soul) return;
  const r = el.getBoundingClientRect();
  // Center the soul on target element (pixel-perfect) — fixed to avoid "first move" mismatch
  const targetX = r.left + r.width / 2;
  const targetY = r.top + r.height / 2;
  soulTarget.x = targetX; soulTarget.y = targetY; soulTarget.active = true;
  soul.style.display = 'block';
  if (instant){
    soul.style.left = (targetX - (soul.offsetWidth||24)/2) + 'px';
    soul.style.top = (targetY - (soul.offsetHeight||24)/2) + 'px';
    // update logical player.soulX/Y so collisions and item usage reference correct coordinates immediately
    player.soulX = targetX;
    player.soulY = targetY;
  } else requestAnimationFrame(animateSoulToTarget);
}
function animateSoulToTarget(){
  if (!soulTarget.active) return;
  const curL = parseFloat(soul.style.left || (window.innerWidth/2 - (soul.offsetWidth||24)/2)+'px');
  const curT = parseFloat(soul.style.top || (window.innerHeight/2 - (soul.offsetHeight||24)/2)+'px');
  const tgtL = soulTarget.x - (soul.offsetWidth||24)/2;
  const tgtT = soulTarget.y - (soul.offsetHeight||24)/2;
  const lerp = 0.22;
  const nx = curL + (tgtL - curL) * lerp;
  const ny = curT + (tgtT - curT) * lerp;
  soul.style.left = nx + 'px'; soul.style.top = ny + 'px';
  // update logical coordinates so collisions are correct during glide
  player.soulX = nx + (soul.offsetWidth||24)/2;
  player.soulY = ny + (soul.offsetHeight||24)/2;
  if (Math.hypot(nx - tgtL, ny - tgtT) > 0.6) requestAnimationFrame(animateSoulToTarget);
  else { soul.style.left = tgtL + 'px'; soul.style.top = tgtT + 'px'; soulTarget.active = false; player.soulX = soulTarget.x; player.soulY = soulTarget.y; }
}
function placeSoulInBattleBoxInstant(){
  if (!dialogueBox || !soul) return;
  const r = dialogueBox.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top + r.height/2;
  soul.style.left = (cx - (soul.offsetWidth||24)/2) + 'px';
  soul.style.top  = (cy - (soul.offsetHeight||24)/2) + 'px';
  player.soulX = cx; player.soulY = cy;
  // Allow soul movement by ensuring pointer events remain none (movement controlled via keyboard), but keep it visible
  soul.style.display = 'block';
}

// -------------------- Ensure Juggernaut on top --------------------
function ensureJuggernautOnTop(){
  if (!enemySprite) return;
  enemySprite.style.position = 'absolute';
  enemySprite.style.zIndex = 99998; // below soul but above dialogue
  if (enemySprite.parentElement !== document.body) document.body.appendChild(enemySprite);
}

// -------------------- Boss HP bar above sprite --------------------
let bossHpContainer = null;
function createBossHpBar(){
  if (bossHpContainer) return bossHpContainer;
  bossHpContainer = document.createElement('div');
  bossHpContainer.id = 'bossHpContainer';
  bossHpContainer.style.position = 'absolute';
  bossHpContainer.style.width = '220px';
  bossHpContainer.style.height = '14px';
  bossHpContainer.style.left = '0px';
  bossHpContainer.style.top = '0px';
  bossHpContainer.style.transform = 'translateX(-50%)';
  bossHpContainer.style.borderRadius = '6px';
  bossHpContainer.style.overflow = 'hidden';
  bossHpContainer.style.display = 'none';
  bossHpContainer.style.zIndex = 99999; // above enemy sprite
  // main green fill
  const fill = document.createElement('div');
  fill.id = 'bossHpFill';
  fill.style.width = '100%';
  fill.style.height = '100%';
  fill.style.background = 'linear-gradient(#36d34a,#0f9a1b)';
  fill.style.transition = 'width 300ms ease';
  bossHpContainer.appendChild(fill);
  // damaged overlay (red), positioned absolute inside container if we prefer
  const red = document.createElement('div');
  red.id = 'bossHpDamaged';
  red.style.position = 'absolute';
  red.style.top = '0';
  red.style.right = '0';
  red.style.height = '100%';
  red.style.width = '0';
  red.style.background = 'rgba(220,20,60,0.95)';
  red.style.transition = 'width 500ms ease';
  bossHpContainer.appendChild(red);
  document.body.appendChild(bossHpContainer);
  return bossHpContainer;
}
function showBossHpAtEnemy(){
  createBossHpBar();
  if (!enemySprite) return;
  const rect = enemySprite.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  bossHpContainer.style.left = cx + 'px';
  bossHpContainer.style.top = (rect.top - 20) + 'px';
  bossHpContainer.style.display = 'block';
}
function hideBossHpBar(){
  if (bossHpContainer) bossHpContainer.style.display = 'none';
}
function updateBossHpVisual(oldPct, newPct){
  createBossHpBar();
  const fill = $('bossHpFill');
  const red = $('bossHpDamaged');
  if (!fill) return;
  fill.style.width = (newPct*100) + '%';
  if (red) {
    const pctDiff = Math.max(0, oldPct - newPct);
    red.style.width = (pctDiff * 100) + '%';
    safeSetTimeout(()=> { red.style.width = '0'; }, 420);
  }
  fill.classList.remove('hp-bounce'); void fill.offsetWidth; fill.classList.add('hp-bounce');
}
(function ensureHpStyle(){
  if (document.getElementById('jb-hp-style')) return;
  const s = document.createElement('style'); s.id = 'jb-hp-style';
  s.innerText = `
    #bossHpContainer { pointer-events:none; }
    #bossHpFill.hp-bounce { animation: hp-bounce 340ms ease; }
    @keyframes hp-bounce { 0%{transform:translateY(0)}30%{transform:translateY(-4px)}100%{transform:translateY(0)} }
    .proj-sprite { pointer-events:none; position:absolute; image-rendering:pixelated; }
  `;
  document.head.appendChild(s);
})();

// -------------------- update enemy hp and spawn floating text anchored to boss bar --------------------
function updateEnemyHPByDamage(damage){
  const oldHp = enemy.hp;
  const oldPct = (enemy.hp / enemy.maxHp);
  enemy.hp = Math.max(0, enemy.hp - damage);
  const newPct = enemy.hp / enemy.maxHp;
  // show/hide boss hp
  showBossHpAtEnemy();
  updateBossHpVisual(oldPct, newPct);
  // spawn floating damage anchored near boss bar
  const barRect = bossHpContainer ? bossHpContainer.getBoundingClientRect() : (enemySprite ? enemySprite.getBoundingClientRect() : null);
  const fx = barRect ? barRect.left + (oldPct * barRect.width) : 520;
  const fy = barRect ? barRect.top - 12 : 120;
  spawnFloatingText('-' + damage, fx, fy, 'crimson', 80);
  stats.damage += damage;
  updateUI();
}

// -------------------- Remove choose your action text globally --------------------
if (dialogueText && dialogueText.textContent && /choose your action/i.test(dialogueText.textContent)) {
  dialogueText.textContent = dialogueText.textContent.replace(/choose your action/ig, '');
}

// -------------------- Screen handling (menu/stats/game) --------------------
function showScreen(s){
  state = s;
  if (menu) menu.classList.toggle('hidden', s !== 'menu');
  if (statsScreen) statsScreen.classList.toggle('hidden', s !== 'stats');
  if (gameScreen) gameScreen.classList.toggle('hidden', s !== 'game');

  if (s === 'menu') {
    // menu visuals & audio
    safePlay(menuMusic);
    // attempt to re-try play on first user interaction if browser blocked autoplay
    tryEnsureMenuMusic();

    if (battleMusic) { battleMusic.pause(); battleMusic.currentTime = 0; }
    // hide battle-only sprites
    if (enemySprite) enemySprite.style.display = 'none';
    // show static decorative soul above title/buttons
    if (soulMenu) {
      soulMenu.style.display = 'block';
      // compute position relative to menu container (center top)
      safeSetTimeout(()=>{ // slight defer so layout is measured correctly
        try {
          const mRect = menu.getBoundingClientRect();
          const w = soulMenu.offsetWidth || 24;
          soulMenu.style.left = (mRect.left + mRect.width / 2 - w/2) + 'px';
          soulMenu.style.top  = (mRect.top + 24) + 'px';
          soulMenu.style.zIndex = 99990;
        } catch(e){}
      }, 8);
    }
    // show interactive soul (used for selecting menu rows)
    if (soul) soul.style.display = 'block';
    // place soul on the current menu row immediately
    const row = document.querySelector('.menu-row[data-index="' + menuIndex + '"]');
    if (row) moveSoulToElement(row, true);
  } else if (s === 'game') {
    // hide static menu decorative soul
    if (soulMenu) soulMenu.style.display = 'none';

    // show battle-only sprites
    if (enemySprite) { enemySprite.style.display = 'block'; ensureJuggernautOnTop(); }
    if (soul) soul.style.display = 'block';
    if (menuMusic) { menuMusic.pause(); menuMusic.currentTime = 0; }
    safePlay(battleMusic);
  } else if (s === 'stats') {
    // hide the decorative menu soul while on stats
    if (soulMenu) soulMenu.style.display = 'none';
    // also hide interactive soul (optional) — keep it hidden to focus stats UI
    if (soul) soul.style.display = 'none';
  }
}

// -------------------- Ensure menu music plays (tries immediately, retries on first user interaction) --------------------
let _menuMusicInteractionHandlerAdded = false;
function tryEnsureMenuMusic(){
  safePlay(menuMusic);
  if (_menuMusicInteractionHandlerAdded) return;
  const tryPlay = () => { safePlay(menuMusic); document.removeEventListener('pointerdown', tryPlay); document.removeEventListener('keydown', tryPlay); _menuMusicInteractionHandlerAdded = false; };
  document.addEventListener('pointerdown', tryPlay, { once: true });
  document.addEventListener('keydown', tryPlay, { once: true });
  _menuMusicInteractionHandlerAdded = true;
}

// -------------------- Menu keyboard and first key audio init --------------------
// keep keyboard triggers intact (Enter/Space to start/open stats)
document.addEventListener('keydown', (e) => {
  keysDown[e.key] = true;
  if (state === 'menu') {
    if (e.key === 'ArrowDown' || e.key === 's') { menuIndex = Math.min(1, menuIndex +1); safePlay(boopSfx); const row = document.querySelector('.menu-row[data-index="' + menuIndex + '"]'); if (row) moveSoulToElement(row); }
    else if (e.key === 'ArrowUp' || e.key === 'w') { menuIndex = Math.max(0, menuIndex - 1); safePlay(boopSfx); const row = document.querySelector('.menu-row[data-index="' + menuIndex + '"]'); if (row) moveSoulToElement(row); }
    else if (e.key === 'Enter' || e.key === ' ') { safePlay(confirmSfx); if (menuIndex === 0) startGame(); else openStats(); }
  }
});
document.addEventListener('keyup', e => delete keysDown[e.key]);

// --- Menu mouse clicks (ENABLED for menu buttons only) ---
if (startBtn) {
  // remove any prior click-blocking logic and allow click to start the game while in menu
  startBtn.addEventListener('click', (e) => {
    if (state === 'menu') {
      e.preventDefault();
      safePlay(confirmSfx);
      startGame();
    }
  });
}
if (statsBtn) {
  statsBtn.addEventListener('click', (e) => {
    if (state === 'menu') {
      e.preventDefault();
      safePlay(confirmSfx);
      openStats();
    }
  });
}
if (backFromStats) {
  // Back button on stats -> return to menu (mouse)
  backFromStats.addEventListener('click', (e) => {
    e.preventDefault();
    safePlay(boopSfx);
    showScreen('menu');
  });
}

// -------------------- openStats (restored) --------------------
function openStats(){
  const sd = $('statDamage'); if (sd) sd.textContent = stats.damage;
  const sr = $('statRounds'); if (sr) sr.textContent = stats.rounds;
  const sde = $('statDeaths'); if (sde) sde.textContent = stats.deaths;
  showScreen('stats');
}

// -------------------- Typing effect with default post delay --------------------
function setTypedDialogue(text, speed=18, postDelay = DEFAULT_DIALOGUE_POST_DELAY){
  return new Promise(res => {
    if (!dialogueText) return res();
    dialogueText.textContent = '';
    let i = 0;
    const t = safeSetInterval(()=> {
      if (i < text.length) { dialogueText.textContent += text[i++]; tickSfx && (tickSfx.currentTime=0, safePlay(tickSfx)); }
      else { safeClearIntervals(); safeSetTimeout(()=> res(), postDelay); }
    }, speed);
  });
}

// -------------------- Start game --------------------
async function startGame(){
  player.hp = player.maxHp; enemy.hp = enemy.maxHp; bullets = []; inAttack = false; playerTurn = true;
  updateUI();
  showScreen('game');

  // reset juggernaut flavor state at battle start
  juggernautTurnCount = 0;
  juggernautLastFlavor = null;
  juggernautRepeatLast = true;

  // Always show the SAME starter line at battle initialization
  await setTypedDialogue(JUGGERNAUT_FLAVORS[0]);
  await wait(DEFAULT_DIALOGUE_POST_DELAY);
  highlightAction(0, true);
}

// -------------------- Highlight / action selection --------------------
function clearAllHighlights(){ actionBtns.forEach(b=>b.classList.remove('selected')); document.querySelectorAll('.choiceItem.highlight').forEach(n=>n.classList.remove('highlight')); }
function highlightAction(idx, instant=false){
  if (!playerTurn) return;
  if (!canNavigate()) return;
  actionIndex = idx;
  clearAllHighlights();
  actionBtns.forEach((b,i)=> b.classList.toggle('selected', i===idx));
  const target = actionBtns[idx];
  if (target) moveSoulToElement(target, instant);
  safePlay(boopSfx);
}

// -------------------- Action keys handling --------------------
document.addEventListener('keydown', async (e) => {
  if (state !== 'game') return;
  if ((e.key === 'ArrowLeft' || e.key === 'a') && canNavigateActions()) highlightAction(Math.max(0, actionIndex - 1));
  else if ((e.key === 'ArrowRight' || e.key === 'd') && canNavigateActions()) highlightAction(Math.min(actionBtns.length - 1, actionIndex + 1));
  else if ((e.key === 'Enter' || e.key === ' ') && playerTurn && !inSlider && !inChoiceMode) {
    const action = actionBtns[actionIndex]?.dataset?.action || actionBtns[actionIndex]?.getAttribute('data-action');
    safePlay(confirmSfx);
    if (action) await performAction(action);
  } else if ((e.key === 'ArrowUp' || e.key === 'w') && canNavigateActions()) {
    const action = actionBtns[actionIndex]?.dataset?.action;
    if (action === 'act') await openActChoices();
    if (action === 'item') await openItemChoices();
  }
});
function canNavigateActions(){ return playerTurn && !inAttack && !inSlider && !inChoiceMode; }

// -------------------- performAction --------------------
async function performAction(action){
  if (!playerTurn) return;
  if (action === 'fight') await startSlider();
  else if (action === 'act') await openActChoices();
  else if (action === 'item') await openItemChoices();
  else if (action === 'mercy') {
    await setTypedDialogue("You spared the Juggernaut. The Juggernaut has not spared you.");
    await wait(DEFAULT_DIALOGUE_POST_DELAY);
    playerTurn = false; startEnemyAttack();
  }
}

// -------------------- Slider (fight mini) --------------------
function startSlider(){
  return new Promise(res => {
    if (inSlider) return res();
    inSlider = true; slider.active = true; slider.pos = 0; slider.dir = 1;
    if (sliderWrap) sliderWrap.classList.remove('hidden');
    function onStop(e){
      if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') { document.removeEventListener('keydown', onStop); finishSlider(true); }
    }
    document.addEventListener('keydown', onStop);
    const t = safeSetTimeout(()=> { document.removeEventListener('keydown', onStop); finishSlider(false); }, slider.duration);
    function finishSlider(pressed){
      safeClearTimeouts();
      slider.active = false; inSlider = false; if (sliderWrap) sliderWrap.classList.add('hidden');
      if (pressed){
        const center = (slider.w - 8) / 2;
        const dist = Math.abs(slider.pos - center);
        const dmg = dist <= SLIDER_CENTER_HIT_RADIUS ? 20 : 7;
        updateEnemyHPByDamage(dmg);
        safePlay(attackSfx);
      }
      safeSetTimeout(async ()=> { playerTurn = false; await startEnemyAttack(); res(); }, 600);
    }
  });
}
// slider draw loop
(function sliderLoop(){
  if (!sliderCtx || !sliderCanvas){ requestAnimationFrame(sliderLoop); return; }
  sliderCtx.clearRect(0,0,sliderCanvas.width,sliderCanvas.height);
  if (slider.active){
    slider.pos += slider.dir * slider.speed;
    if (slider.pos <= 0) { slider.pos = 0; slider.dir = 1; }
    if (slider.pos >= slider.w - 8) { slider.pos = slider.w - 8; slider.dir = -1; }
    sliderCtx.fillStyle = '#000'; sliderCtx.fillRect(30,6,slider.w,28);
    const centerLeft = 30 + (slider.w/2 - 18);
    sliderCtx.fillStyle = '#000'; sliderCtx.fillRect(centerLeft,6,36,28);
    sliderCtx.lineWidth = 3; sliderCtx.strokeStyle = '#ffd92a'; sliderCtx.strokeRect(centerLeft,6,36,28);
    sliderCtx.fillStyle = '#fff'; sliderCtx.fillRect(30 + slider.pos, 6, 8, 28);
  }
  requestAnimationFrame(sliderLoop);
})();

// -------------------- ACT & ITEM choices (clear dialog on open, restore last dialog on close) --------------------
function storeAndClearDialog(){ lastDialogText = dialogueText ? dialogueText.textContent : ''; if (dialogueText) dialogueText.textContent = ''; }
function restoreDialog(){ if (dialogueText) dialogueText.textContent = lastDialogText || ''; }

// convenience renderer for choice lists
function renderChoicesList(list, onChoose, onCancel){
  if (!choiceGrid) return;
  choiceGrid.innerHTML = '';
  choiceGrid.classList.remove('hidden');
  inChoiceMode = true; currentChoices = [];
  list.forEach((opt, i) => {
    const div = document.createElement('div');
    div.className = 'choiceItem';
    div.innerHTML = '* ' + opt.label;
    div.dataset.idx = i; div.dataset.key = opt.key;
    div.addEventListener('mouseenter', ()=> moveSoulToElement(div) );
    choiceGrid.appendChild(div);
    currentChoices.push({ el: div, key: opt.key, idx: i });
  });
  // initialize highlight/soul
  let sel = 0; dedupeHighlight(currentChoices[sel].el); moveSoulToElement(currentChoices[sel].el, true); safePlay(boopSfx);
  // keyboard nav
  function nav(e){
    if (!inChoiceMode) return;
    if (e.key === 'Backspace' || e.key === 'Escape') { document.removeEventListener('keydown', nav); onCancel && onCancel(); return; }
    if (['ArrowLeft','a'].includes(e.key)) changeSel(-1);
    if (['ArrowRight','d'].includes(e.key)) changeSel(1);
    if (['ArrowUp','w'].includes(e.key)) changeSel(-2);
    if (['ArrowDown','s'].includes(e.key)) changeSel(2);
    if (e.key === 'Enter' || e.key === ' ') { document.removeEventListener('keydown', nav); onChoose && onChoose(currentChoices[sel].key); }
  }
  function changeSel(d){
    currentChoices[sel].el.classList.remove('highlight');
    sel = Math.max(0, Math.min(currentChoices.length-1, sel + d));
    dedupeHighlight(currentChoices[sel].el);
    moveSoulToElement(currentChoices[sel].el);
    safePlay(boopSfx);
  }
  document.addEventListener('keydown', nav);
}

function dedupeHighlight(el){ document.querySelectorAll('.choiceItem.highlight').forEach(n=>n.classList.remove('highlight')); if (el) el.classList.add('highlight'); }

// openActChoices
function openActChoices(){
  return new Promise(res => {
    storeAndClearDialog();
    const opts = [{key:'check',label:'Check'},{key:'praise',label:'Praise'},{key:'cry',label:'Cry'},{key:'dance',label:'Dance'}];
    renderChoicesList(opts, async (key) => {
      inChoiceMode = false; choiceGrid.innerHTML = ''; // auto clear
      if (key === 'check') await setTypedDialogue(acts.check.msgs[0]);
      else if (key === 'praise') { const a = acts.praise; await setTypedDialogue(a.msgs[a.idx]); a.idx = Math.min(a.idx+1,a.msgs.length-1); }
      else if (key === 'cry') { const a = acts.cry; await setTypedDialogue(a.msgs[a.idx]); a.idx = Math.min(a.idx+1,a.msgs.length-1); }
      else if (key === 'dance') { const a = acts.dance; await setTypedDialogue(a.msgs[Math.min(a.idx,a.msgs.length-1)]); a.danceCount=(a.danceCount||0)+1; a.idx=Math.min(a.idx+1,a.msgs.length-1); }
      await wait(DEFAULT_DIALOGUE_POST_DELAY);
      restoreDialog();
      playerTurn = false;
      safeSetTimeout(()=> startEnemyAttack(), 700);
      res();
    }, () => {
      // cancel
      inChoiceMode = false; choiceGrid.innerHTML = ''; restoreDialog();
      safeSetTimeout(()=> { playerTurn = false; startEnemyAttack(); }, 700);
      res();
    });
  });
}

// openItemChoices
function openItemChoices(){
  return new Promise(res => {
    storeAndClearDialog();
    const keys = Object.keys(items).filter(k => items[k].count > 0);
    if (keys.length === 0) { setTypedDialogue("You have no items.").then(()=> { inChoiceMode=false; playerTurn=false; startEnemyAttack(); res(); }); return; }
    const opts = keys.map(k => ({ key:k, label:k }));
    renderChoicesList(opts, (key)=> {
      // consume
      items[key].count = Math.max(0, items[key].count-1);
      const heal = items[key].heal || 0;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      spawnFloatingText('+'+heal, player.soulX, player.soulY, 'lime', 100);
      safePlay(healSfx);
      setTypedDialogue("You ate the " + key + ".").then(()=>{ restoreDialog(); playerTurn=false; setTimeout(()=> startEnemyAttack(),700); });
      inChoiceMode = false; choiceGrid.innerHTML = '';
      res();
    }, () => {
      inChoiceMode = false; choiceGrid.innerHTML = ''; restoreDialog();
      safeSetTimeout(()=> { playerTurn=false; startEnemyAttack(); }, 700);
      res();
    });
  });
}

// -------------------- Enemy attack sequence (square battle box, clear projectiles at end, soul center) --------------------
function startEnemyAttack(repeats = ATTACK_REPEAT_DEFAULT){
  if (inAttack) return;
  inAttack = true;
  bullets = bullets.filter(b => b.isText); // preserve floating texts but remove existing projectiles
  playerTurn = false;
  // clear dialogue text immediately
  if (dialogueText) dialogueText.textContent = '';
  // convert dialogue box to a perfect square battle box (half size)
  if (dialogueBox) {
    const size = 260; // half-size as requested
    dialogueBox.classList.add('battle-box');
    dialogueBox.style.width = size + 'px';
    dialogueBox.style.height = size + 'px';
    dialogueBox.style.background = '#000';
  }
  // center soul inside that square and allow movement (soul remains visible)
  placeSoulInBattleBoxInstant();
  // remove button selections and prevent interaction
  clearAllHighlights();
  actionBtns.forEach(b => {
    // disable all action buttons so they can't be interacted with during/after attack
    b.disabled = true;
    // make sure the yellow highlight is removed
    b.classList.remove('selected');
  });

  // ensure enemy sprite shown & on top
  if (enemySprite) { enemySprite.style.display = 'block'; ensureJuggernautOnTop(); }

  // choose a single pattern and repeat it randomly 3–5 times
  const repeatsRandom = 3 + Math.floor(Math.random()*3);
  const patternId = pickRandomPattern();
  let i = 0;
  function runOnce(){
    runAttackPattern(patternId).then(()=> {
      i++;
      // do NOT clear projectiles between repeats - only wipe at the end of the whole attack
      if (i < repeatsRandom) safeSetTimeout(runOnce, ATTACK_REPEAT_GAP_MS);
      else endAttack();
    });
  }
  // small delay so the cleaned dialog has a moment before bullets spawn
  safeSetTimeout(runOnce, 180);
}

function endAttack(){
  inAttack = false;
  // clear projectiles only at the end of the whole attack
  clearAllProjectiles();
  // restore dialogue box size (remove square)
  if (dialogueBox) {
    dialogueBox.classList.remove('battle-box');
    dialogueBox.style.width = '';
    dialogueBox.style.height = '';
    dialogueBox.style.background = '#000';
  }
  // hide boss hp after a bit
  safeSetTimeout(()=> { hideBossHpBar(); }, 1000);
  // re-enable buttons and return control after a short delay
  safeSetTimeout(async ()=> {
    await displayJuggernautFlavor();
    playerTurn = true;
    actionBtns.forEach(b => b.disabled = false);
    highlightAction(0, true);
  }, 420);
}

// -------------------- Pick patterns --------------------
function pickRandomPattern(){
  // 0 = juggernautface, 1 = foolscoin, 2 = fist, 3 = bullet
  return Math.floor(Math.random() * 4);
}

// -------------------- run a single attack pattern --------------------
function runAttackPattern(id){
  return new Promise(res => {
    if (id === 0) runJuggernautFace(res);
    else if (id === 1) runFoolsCoin(res);
    else if (id === 2) runFist(res);
    else runBullet(res);
  });
}

// Helpers to compute positions around the dialogue (spawn surrounding the battle box)
function getBattleBoxRect(){
  if (!dialogueBox) return { left: 480, top: 120, width: 260, height: 260 };
  return dialogueBox.getBoundingClientRect();
}
function chooseSpawnSide(){ // returns 'left' | 'right' | 'top' | 'corner'
  const r = Math.random();
  if (r < 0.28) return 'left';
  if (r < 0.56) return 'right';
  if (r < 0.84) return 'top';
  return 'corner';
}

// -------------------- Attack pattern implementations --------------------

// 5.1 proj_juggernautface - 10-15 sprayed from a randomly chosen corner of the battle box.
// spawn sound: jugatk1.wav
function runJuggernautFace(done){
  const rect = getBattleBoxRect();
  // corners: TL, TR, BL, BR
  const cornerIndex = Math.floor(Math.random() * 4);
  let sx = rect.left + (cornerIndex % 2 === 0 ? 0 : rect.width);
  let sy = rect.top + (cornerIndex < 2 ? 0 : rect.height);
  // spawn 10-15
  const cnt = 10 + Math.floor(Math.random() * 6);
  // spread them quickly
  for (let k = 0; k < cnt; k++){
    // small random offset so not perfectly overlapped
    const ox = (Math.random() - 0.5) * 12;
    const oy = (Math.random() - 0.5) * 12;
    // velocity directed towards box center
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    const ang = Math.atan2(cy - (sy + oy), cx - (sx + ox));
    const sp = 2 + Math.random()*1.8;
    const vx = Math.cos(ang)*sp;
    const vy = Math.sin(ang)*sp;
    spawnProjectileSprite(sx + ox, sy + oy, vx, vy, 'assets/images/proj_juggernautface.png');
    if (jugatk1Sfx) { try{ jugatk1Sfx.currentTime = 0; safePlay(jugatk1Sfx); } catch(e){} }
  }
  // let them move for a while before finishing pattern
  safeSetTimeout(done, 1400 + Math.random()*600);
}

// 5.2 proj_foolscoin - 30 foolscoins over 8 seconds dropped onto the battlebox, warning via red circle shapes.
// - use jugatk2.wav when the foolscoin drops, and boop for the warning.
// - allow each warning to be visible for 1.2s of the total 2s before the drop. (USER requested static red shapes; they will be static)
function runFoolsCoin(done){
  const rect = getBattleBoxRect();
  const total = 30;
  const durationMs = 8000;
  const interval = durationMs / total;
  let spawned = 0;
  const iv = safeSetInterval(()=>{
    if (spawned >= total){
      safeClearIntervals();
      safeSetTimeout(()=> done(), 600);
      return;
    }
    spawned++;
    // choose a spawn x inside the box (so it drops onto the box)
    const x = rect.left + 12 + Math.random() * (rect.width - 24);
    const warnY = rect.top - 28; // just above box
    // create a red circle warning element (static)
    const warn = document.createElement('div');
    warn.className = 'proj-sprite warn-circle';
    warn.style.width = '20px';
    warn.style.height = '20px';
    warn.style.borderRadius = '50%';
    warn.style.background = 'red';
    warn.style.opacity = '0.9';
    warn.style.left = (x - 10) + 'px';
    warn.style.top = (warnY) + 'px';
    projectileLayer.appendChild(warn);
    // beep warning
    if (boopSfx) { try{ boopSfx.currentTime = 0; safePlay(boopSfx); } catch(e){} }
    // after 1200ms remove warning and spawn coin dropping down
    safeSetTimeout(()=>{
      if (warn.parentElement) warn.parentElement.removeChild(warn);
      // spawn coin slightly above the box, falling down
      spawnProjectileSprite(x, rect.top - 8, 0, 2 + Math.random()*0.6, 'assets/images/proj_foolscoin.png');
      if (jugatk2Sfx) { try{ jugatk2Sfx.currentTime = 0; safePlay(jugatk2Sfx); } catch(e){} }
    }, 1200);
  }, interval);
}

// 5.3 proj_fist - like foolscoin but bigger, fewer and longer warnings. at most 12 fists, 8 seconds
function runFist(done){
  const rect = getBattleBoxRect();
  const total = 12;
  const durationMs = 8000;
  const interval = durationMs / total;
  let spawned = 0;
  const iv = safeSetInterval(()=>{
    if (spawned >= total){
      safeClearIntervals();
      safeSetTimeout(()=> done(), 700);
      return;
    }
    spawned++;
    const x = rect.left + 20 + Math.random() * (rect.width - 40);
    const warnY = rect.top - 36;
    const warn = document.createElement('div');
    warn.className = 'proj-sprite warn-fist';
    warn.style.width = '40px';
    warn.style.height = '40px';
    warn.style.background = 'red';
    warn.style.opacity = '0.95';
    warn.style.left = (x - 20) + 'px';
    warn.style.top = (warnY) + 'px';
    projectileLayer.appendChild(warn);
    if (boopSfx) { try{ boopSfx.currentTime = 0; safePlay(boopSfx); } catch(e){} }
    // longer warning: 2000ms
    safeSetTimeout(()=>{
      if (warn.parentElement) warn.parentElement.removeChild(warn);
      spawnProjectileSprite(x, rect.top - 20, 0, 1.2 + Math.random()*0.6, 'assets/images/proj_fist.png');
      if (jugatk2Sfx) { try{ jugatk2Sfx.currentTime = 0; safePlay(jugatk2Sfx); } catch(e){} }
    }, 2000);
  }, interval);
}

// 5.4 proj_bullet - red warning lines cross through the box horizontally, then a single bullet swipes across the line.
// wait about 0.2 seconds before the bullet is sprayed to spawn the next line. at most 12 bullets, 8 seconds
function runBullet(done){
  const rect = getBattleBoxRect();
  const total = 12;
  const durationMs = 8000;
  const interval = durationMs / total;
  let spawned = 0;
  const iv = safeSetInterval(()=>{
    if (spawned >= total){
      safeClearIntervals();
      safeSetTimeout(()=> done(), 700);
      return;
    }
    spawned++;
    // choose a y inside the box
    const y = rect.top + 10 + Math.random() * (rect.height - 20);
    // create red warning line (static)
    const warn = document.createElement('div');
    warn.className = 'proj-sprite warn-line';
    warn.style.width = rect.width + 'px';
    warn.style.height = '4px';
    warn.style.background = 'red';
    warn.style.left = (rect.left) + 'px';
    warn.style.top = (y - 2) + 'px';
    warn.style.opacity = '0.9';
    projectileLayer.appendChild(warn);
    if (boopSfx) { try{ boopSfx.currentTime = 0; safePlay(boopSfx); } catch(e){} }
    // after a short 200ms remove warn and spawn bullet sweeping across
    safeSetTimeout(()=>{
      if (warn.parentElement) warn.parentElement.removeChild(warn);
      // decide left->right or right->left randomly
      const leftToRight = Math.random() < 0.5;
      const sx = leftToRight ? rect.left - 40 : rect.left + rect.width + 40;
      const vx = leftToRight ? 6 : -6;
      spawnProjectileSprite(sx, y, vx, 0, 'assets/images/proj_bullet.png');
      if (jugatk2Sfx) { try{ jugatk2Sfx.currentTime = 0; safePlay(jugatk2Sfx); } catch(e){} }
    }, 200);
  }, interval);
}

// -------------------- spawn projectile helper --------------------
function spawnProjectileSprite(x,y,vx,vy,src){
  const img = document.createElement('img');
  img.src = src || 'assets/images/proj_juggernautface.png';
  img.className = 'proj-sprite';
  img.style.position = 'absolute';
  img.style.left = (x - 12) + 'px';
  img.style.top  = (y - 12) + 'px';
  img.style.width = '24px'; img.style.height = '24px'; img.style.pointerEvents='none';
  projectileLayer.appendChild(img);
  bullets.push({ dom: img, x:x, y:y, vx: vx, vy: vy, r: 10 });
}

// -------------------- Display Juggernaut flavor logic --------------------
async function displayJuggernautFlavor(){
  juggernautTurnCount = (juggernautTurnCount || 0) + 1;
  if (juggernautTurnCount === 24) {
    for (const line of JUGGERNAUT_LEMON_SEQ) {
      await setTypedDialogue(line);
    }
    await setTypedDialogue(JUGGERNAUT_INVITE);
    juggernautLastFlavor = null;
    juggernautRepeatLast = false;
    return;
  }

  if (!juggernautLastFlavor || juggernautRepeatLast === false) {
    const choices = JUGGERNAUT_FLAVORS.slice();
    if (juggernautTurnCount === 1 && choices.length > 1) choices.shift();
    const pick = choices[Math.floor(Math.random() * choices.length)];
    juggernautLastFlavor = pick;
  }

  await setTypedDialogue(juggernautLastFlavor);
  if (juggernautTurnCount < 24) juggernautRepeatLast = true;
}

// -------------------- Bullet movement & collision --------------------
function updateBullets(){
  for (let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];
    if (b.isText) { b.y -= 0.6; b.life--; if (b.life<=0) bullets.splice(i,1); continue; }
    b.x += b.vx; b.y += b.vy;
    if (b.dom) { b.dom.style.left = (b.x - (b.dom.width||12)/2) + 'px'; b.dom.style.top = (b.y - (b.dom.height||12)/2) + 'px'; }
    const dx = b.x - player.soulX, dy = b.y - player.soulY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < (b.r + player.size/2)) {
      if (b.dom) b.dom.remove();
      bullets.splice(i,1);
      const dmg = 30; player.hp = Math.max(0, player.hp - dmg);
      spawnFloatingText('-' + dmg, player.soulX, player.soulY, 'crimson', 100);
      hitSfx && (hitSfx.currentTime = 0, safePlay(hitSfx));
      if (hpLost) { hpLost.style.width = Math.min(100, (dmg / player.maxHp) * 100) + '%'; hpLost.style.opacity = '0.95'; safeSetTimeout(()=>{ hpLost.style.opacity='0'; hpLost.style.width='0'; },700); }
      updateUI();
      if (player.hp <= 0) {
        stats.deaths += 1;
        setTypedDialogue("You died. Game over.").then(()=> {
          wait(DEFAULT_DIALOGUE_POST_DELAY).then(()=> { cleanupOnDeath(); showScreen('menu'); });
        });
      }
      continue;
    }
    if (b.x < -200 || b.x > (canvas ? canvas.width + 200 : 1400) || b.y > (canvas ? canvas.height + 200 : 1200) || b.y < -400) {
      if (b.dom) b.dom.remove();
      bullets.splice(i,1);
    }
  }
}

// -------------------- Floating text + render --------------------
function spawnFloatingText(txt,x,y,color='white',life=100){ bullets.push({ isText:true, text:txt, x:x, y:y, color:color, life:life }); }
function render(){
  if (ctx && canvas) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for (const b of bullets){
      if (b.isText) { ctx.fillStyle = b.color || '#fff'; ctx.font = "14px 'Press Start 2P', monospace"; ctx.fillText(b.text, b.x, b.y); }
    }
  }
  updateBullets();
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// -------------------- slider loop (duplicate - kept as-is) --------------------
(function sliderLoop(){
  if (!sliderCtx || !sliderCanvas) { requestAnimationFrame(sliderLoop); return; }
  sliderCtx.clearRect(0,0,sliderCanvas.width, sliderCanvas.height);
  if (slider.active){
    slider.pos += slider.dir * slider.speed;
    if (slider.pos <= 0) { slider.pos = 0; slider.dir = 1; }
    if (slider.pos >= slider.w - 8) { slider.pos = slider.w - 8; slider.dir = -1; }
    sliderCtx.fillStyle = '#000'; sliderCtx.fillRect(30,6,slider.w,28);
    const centerLeft = 30 + (slider.w/2 - 18);
    sliderCtx.fillStyle = '#000'; sliderCtx.fillRect(centerLeft,6,36,28);
    sliderCtx.lineWidth = 3; sliderCtx.strokeStyle = '#ffd92a'; sliderCtx.strokeRect(centerLeft,6,36,28);
    sliderCtx.fillStyle = '#fff'; sliderCtx.fillRect(30 + slider.pos, 6, 8, 28);
  }
  requestAnimationFrame(sliderLoop);
})();

// -------------------- small helpers & init --------------------
function wait(ms){ return new Promise(res => safeSetTimeout(res, ms)); }
function updateUI(){
  if (hpCur) hpCur.textContent = player.hp;
  if (hpMax) hpMax.textContent = player.maxHp;
  if (hpBar) hpBar.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
  if (enemyHpBar) enemyHpBar.style.width = Math.max(0, (enemy.hp / enemy.maxHp) * 100) + '%';
}
function clearAllProjectilesAndBullets(){ clearAllProjectiles(); bullets = bullets.filter(b=>b.isText); }

// restore juggernaut visibility only in battle
function ensureJuggernautOnTop(){ if (!enemySprite) return; enemySprite.style.position='absolute'; enemySprite.style.zIndex=99998; if (enemySprite.parentElement !== document.body) document.body.appendChild(enemySprite); }

// attach action button clicks (still disabled for mouse—keyboard-only in-game)
actionBtns.forEach((btn, idx) => {
  // prevent mouse click activation on action buttons (gameplay intentionally keyboard-driven)
  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
});

// init
(function init(){
  updateUI();
  showScreen('menu');
  // initial menu soul placement (if menu rows exist) — already handled by showScreen('menu') but keep a safety immediate placement
  const row = document.querySelector('.menu-row[data-index="' + menuIndex + '"]');
  if (row) moveSoulToElement(row, true);
})();

