
// v5 main.js - UI/Audio/Layout fixes per user
const STATE = {MENU:'menu', STATS:'stats', GAME:'game'};
let currentState = STATE.MENU;

// DOM refs
const menu = document.getElementById('menu');
const statsScreen = document.getElementById('stats');
const gameScreen = document.getElementById('game');
const startBtn = document.getElementById('startBtn');
const statsBtn = document.getElementById('statsBtn');
const backFromStats = document.getElementById('backFromStats');
const menuMusic = document.getElementById('menuMusic');
const battleMusic = document.getElementById('battleMusic');
const boopSfx = document.getElementById('boopSfx');
const confirmSfx = document.getElementById('confirmSfx');
const healSfx = document.getElementById('healSfx');
const tickSfx = document.getElementById('tickSfx');
const attackSfx = document.getElementById('attackSfx');
const hitSfx = document.getElementById('hitSfx');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const dialogueText = document.getElementById('dialogueText');
const dialogueBox = document.getElementById('dialogueBox');
const sliderWrap = document.getElementById('sliderWrap');
const sliderCanvas = document.getElementById('sliderCanvas');
const sliderCtx = sliderCanvas.getContext('2d');
const actionBtns = Array.from(document.querySelectorAll('.actionBtn'));
const itemRow = document.getElementById('itemRow');
const hpCurEl = document.getElementById('hpCur');
const hpMaxEl = document.getElementById('hpMax');
const hpBar = document.getElementById('hpBar');
const hpLost = document.getElementById('hpLost');
const soul = document.getElementById('soul');
const soulMenu = document.getElementById('soulMenu');
const enemySprite = document.getElementById('enemySprite');

// stats and entities
let stats = {damage:0, rounds:0, deaths:0};
let player = {hp:400, maxHp:400, soulX:480, soulY:520, size:24};
let enemy = {hp:940, maxHp:940, atk:120, def:100, jailed:false};
let items = {LarvaeCookie:{count:1,heal:45},GalaNoodles:{count:1,heal:60},TheEarnestCake:{count:1,heal:90},Mycelium:{count:3,heal:15},ClippertonFruitPunch:{count:1,heal:58},HoardedSourdough:{count:1,heal:100}};

// act sequences
let acts = {
  check:{msgs:["HP - 940/940  ATK - 120  DEF - 100. They call him the juggernaut."], idx:0},
  praise:{msgs:["You told the Juggernaut you think he's an excellent writer. His smile curves slightly tighter.","You told the Juggernaut you denounce all worms. A spindly appendage moves inside his coat.","You told the Juggernaut that there is nothing more exciting than a number challenge. The Juggernaut doesn't react.","You told the Juggernaut that he is the juggernaut around these parts. He continues to smile.","You tell the Juggernaut he could lose the fedora and his head would look just as fine. He doesn't seem to understand."], idx:0},
  cry:{msgs:["You begin to tear at the eyes. The Juggernaut sniffles at you.","You start to fake cry. The Juggernaut's ATK has increased!"], idx:0},
  dance:{msgs:["Your left foot starts to tap on the ground. The Juggernaut's face contorts.","You start to hum a song and create a tempo... The Juggernaut moves slightly closer.","You get a charlie horse in your shoulder and stop dancing. The Juggernaut exclaims \"Charlie horse!\"."], idx:0, danceCount:0}
};

// UI state
let selectedIndex = 0;
let inAttackSequence = false;
let bullets = [];
let sliderActive = false;
let sliderPos = 0, sliderDir = 1;

// soul menu positions mapping to buttons (for glide)
const menuBtnEls = [document.getElementById('startBtn'), document.getElementById('statsBtn')];
function placeSoulMenuAtButton(idx){
  const btn = menuBtnEls[idx];
  const rect = btn.getBoundingClientRect();
  const parentRect = btn.parentElement.getBoundingClientRect();
  soulMenu.style.left = (rect.left - parentRect.left - 30) + 'px';
  soulMenu.style.top = (rect.top - parentRect.top + 6) + 'px';
}

// Screen management
function showScreen(s){
  currentState = s;
  menu.classList.toggle('hidden', s !== STATE.MENU);
  statsScreen.classList.toggle('hidden', s !== STATE.STATS);
  gameScreen.classList.toggle('hidden', s !== STATE.GAME);
  if(s === STATE.MENU){ safePlay(menuMusic); battleMusic.pause(); battleMusic.currentTime = 0; placeSoulMenuAtButton(0); soulMenu.style.display='block'; soul.style.display='none'; }
  if(s === STATE.GAME){ soulMenu.style.display='none'; soul.style.display='block'; safePlay(battleMusic); menuMusic.pause(); menuMusic.currentTime = 0; }
}

// audio helper
def = None
function safePlay(audio){
  if(!audio) return;
  try{ const p = audio.play(); if(p && p.catch) p.catch(()=>{}); }catch(e){}
}

// initial interactions to allow autoplay later
document.addEventListener('keydown', function initOnce(){
  safePlay(menuMusic);
  document.removeEventListener('keydown', initOnce);
});

// menu interactions
let menuSelection = 0; // 0 start, 1 stats
document.addEventListener('keydown', (e)=>{
  if(currentState === STATE.MENU){
    if(e.key === 'ArrowRight' || e.key === 'd'){ menuSelection = Math.min(menuSelection+1, menuBtnEls.length-1); safePlay(boopSfx); placeSoulMenuAtButton(menuSelection); }
    if(e.key === 'ArrowLeft' || e.key === 'a'){ menuSelection = Math.max(menuSelection-1, 0); safePlay(boopSfx); placeSoulMenuAtButton(menuSelection); }
    if(e.key === 'Enter' || e.key === ' '){ safePlay(confirmSfx); if(menuSelection===0) startGame(); else openStats(); }
  }
});

startBtn.onclick = ()=>{ safePlay(confirmSfx); startGame(); };
statsBtn.onclick = ()=>{ safePlay(boopSfx); openStats(); };
backFromStats && (backFromStats.onclick = ()=>{ safePlay(boopSfx); showScreen(STATE.MENU); });

function openStats(){ document.getElementById('statDamage').textContent = stats.damage; document.getElementById('statRounds').textContent = stats.rounds; document.getElementById('statDeaths').textContent = stats.deaths; showScreen(STATE.STATS); }

// Start game
def = None
function startGame(){
  // reset
  player.hp = player.maxHp; enemy.hp = enemy.maxHp; bullets = []; selectedIndex = 0; inAttackSequence = false;
  updateHPUI();
  showScreen(STATE.GAME);
  setDialogue("The Juggernaut stares at you. Choose an action.");
  highlightButton(selectedIndex);
  // place soul near action buttons
  const actRect = actionBtns[0].getBoundingClientRect();
  const parentRect = actionBtns[0].parentElement.getBoundingClientRect();
  soul.style.left = (actRect.left - parentRect.left + 16) + 'px';
  soul.style.top = (actRect.top - parentRect.top - 30) + 'px';
}

// dialogue management with typing effect
let typingTimeout = null;
function setDialogue(text, speed=24, clearAfter=0){
  // cancel previous typing
  if(typingTimeout) clearTimeout(typingTimeout);
  dialogueText.textContent = '';
  let i = 0;
  function typeNext(){
    if(i < text.length){
      dialogueText.textContent += text[i];
      // tick
      tickSfx.currentTime = 0; safePlay(tickSfx);
      i++;
      typingTimeout = setTimeout(typeNext, speed);
    } else {
      typingTimeout = null;
      if(clearAfter>0) setTimeout(()=>{ dialogueText.textContent=''; }, clearAfter);
    }
  }
  typeNext();
}

// update HP UI
function updateHPUI(damageAmount=0){
  hpCurEl.textContent = player.hp;
  hpMaxEl.textContent = player.maxHp;
  const pct = Math.max(0, player.hp/player.maxHp);
  hpBar.style.width = (pct*100) + '%';
  if(damageAmount>0){
    const lostPct = Math.min(1, damageAmount/player.maxHp);
    hpLost.style.width = (lostPct*100) + '%';
    hpLost.style.opacity = '0.9';
    setTimeout(()=>{ hpLost.style.opacity='0'; hpLost.style.width='0'; }, 600);
  }
}

// Highlight action button
function highlightButton(idx){
  actionBtns.forEach((b,i)=>{ b.classList.toggle('selected', i===idx); });
  // move soul to above selected button (glide)
  const rect = actionBtns[idx].getBoundingClientRect();
  const parentRect = actionBtns[idx].parentElement.getBoundingClientRect();
  soul.style.left = (rect.left - parentRect.left + 60) + 'px';
  soul.style.top = (rect.top - parentRect.top - 30) + 'px';
  safePlay(boopSfx);
}

// keyboard for battle UI
document.addEventListener('keydown', (e)=>{
  if(currentState !== STATE.GAME) return;
  if(inAttackSequence){
    // move soul inside dialogue/attack box
    if(e.key==='ArrowLeft'||e.key==='a') player.soulX = Math.max(200, player.soulX-12);
    if(e.key==='ArrowRight'||e.key==='d') player.soulX = Math.min(760, player.soulX+12);
    if(e.key==='ArrowUp'||e.key==='w') player.soulY = Math.max(360, player.soulY-12);
    if(e.key==='ArrowDown'||e.key==='s') player.soulY = Math.min(520, player.soulY+12);
    soul.style.left = (player.soulX - 12) + 'px'; soul.style.top = (player.soulY - 12) + 'px';
    return;
  }
  // navigate action buttons when not attacking
  if(e.key==='ArrowLeft'||e.key==='a'){ selectedIndex = Math.max(0, selectedIndex-1); highlightButton(selectedIndex); e.preventDefault(); }
  if(e.key==='ArrowRight'||e.key==='d'){ selectedIndex = Math.min(actionBtns.length-1, selectedIndex+1); highlightButton(selectedIndex); e.preventDefault(); }
  if((e.key==='Enter'||e.key===' ') && !sliderActive){ safePlay(confirmSfx); const action = actionBtns[selectedIndex].dataset.action; handleAction(action); e.preventDefault(); }
  // allow holding up to go into dialogue box for sub-selection
  if((e.key==='ArrowUp'||e.key==='w')){
    // If selecting ACT or ITEM, move soul into dialogue area for sub-choices
    const action = actionBtns[selectedIndex].dataset.action;
    if(action==='act' || action==='item'){
      // move soul to dialogue box top-left
      soul.style.top = (dialogueBox.getBoundingClientRect().top - dialogueBox.parentElement.getBoundingClientRect().top + 8) + 'px';
      soul.style.left = (dialogueBox.getBoundingClientRect().left - dialogueBox.parentElement.getBoundingClientRect().left + 12) + 'px';
    }
  }
});

// handle action pressed
function handleAction(action){
  if(action==='fight') startFightTurn();
  if(action==='act') openActSelection();
  if(action==='item') openItemMenu();
  if(action==='mercy') { setDialogue("You spared the Juggernaut. The Juggernaut has not spared you."); setTimeout(()=>startEnemyAttack(),700); }
}

// slider always in dialogue box when active
function startFightTurn(){
  setDialogue("You prepare to fight. Press Space to stop the slider for max damage.", 18);
  sliderWrap.classList.remove('hidden');
  sliderActive = true; sliderPos = 0; sliderDir = 1;
  // attach space handler
  function onSpace(e){
    if(e.code==='Space' || e.key===' ' || e.key==='Enter'){
      document.removeEventListener('keydown', onSpace);
      // compute dmg
      const center = (sliderCanvas.width-8)/2;
      const dist = Math.abs(sliderPos - center);
      const dmg = dist <= 18 ? 20 : 7;
      enemy.hp = Math.max(0, enemy.hp - dmg);
      stats.damage += dmg;
      attackSfx.currentTime = 0; safePlay(attackSfx);
      setDialogue(`You dealt ${dmg} damage!`, 600);
      sliderActive = false; sliderWrap.classList.add('hidden');
      if(enemy.hp<=0){ enemyDead(); return; }
      setTimeout(()=>startEnemyAttack(),700);
    }
  }
  document.addEventListener('keydown', onSpace);
}

// ACT selection moves into dialogue box sub-options; show only options available and allow soul to move into box and choose with left/right then confirm
function openActSelection(){
  const options = ['check','praise','cry','dance'];
  let sel = 0;
  function renderActPrompt(){ setDialogue("Act: " + options.map((o,i)=> (i===sel?`[${o}]`:o)).join('   '), 12); }
  renderActPrompt();
  function actNav(e){
    if(e.key==='ArrowLeft'||e.key==='a'){ sel = (sel-1+options.length)%options.length; safePlay(boopSfx); renderActPrompt(); }
    if(e.key==='ArrowRight'||e.key==='d'){ sel = (sel+1)%options.length; safePlay(boopSfx); renderActPrompt(); }
    if(e.key==='Enter'||e.key===' '){
      document.removeEventListener('keydown', actNav);
      safePlay(confirmSfx);
      const choice = options[sel];
      if(choice==='check'){ setDialogue(acts.check.msgs[0], 18); }
      else if(choice==='praise'){ const a=acts.praise; setDialogue(a.msgs[a.idx],18); a.idx = Math.min(a.idx+1,a.msgs.length-1); }
      else if(choice==='cry'){ const a=acts.cry; setDialogue(a.msgs[a.idx],18); a.idx = Math.min(a.idx+1,a.msgs.length-1); }
      else if(choice==='dance'){ const a=acts.dance; setDialogue(a.msgs[Math.min(a.idx,a.msgs.length-1)],18); a.danceCount = (a.danceCount||0)+1; a.idx = Math.min(a.idx+1,a.msgs.length-1); if(a.danceCount>=15) setDialogue("You begin performing a festive jig. The Juggernaut smirks and compliments your festive jig.",18); }
      setTimeout(()=>startEnemyAttack(),700);
    }
    if(e.key==='Escape'){ document.removeEventListener('keydown', actNav); setDialogue("You step back.", 400); setTimeout(()=>startEnemyAttack(),700); }
  }
  document.addEventListener('keydown', actNav);
}

// Item menu: keyboard left/right to select and Enter to confirm
function openItemMenu(){
  itemRow.innerHTML='';
  const keys = Object.keys(items);
  keys.forEach((k,i)=>{
    const el = document.createElement('div'); el.className='itemCell'; el.style.border='2px solid #444'; el.style.padding='6px'; el.innerHTML=`<div style="font-size:11px">${k}</div><div style="font-size:11px">x${items[k].count}</div><div style="font-size:11px">+${items[k].heal}HP</div>`;
    itemRow.appendChild(el);
  });
  itemRow.classList.remove('hidden');
  let sel = 0; highlightItem(sel);
  function highlightItem(idx){ Array.from(itemRow.children).forEach((c,i)=> c.style.outline = (i===idx)?'2px solid yellow':'2px solid #444'); safePlay(boopSfx); }
  function nav(e){
    if(e.key==='ArrowLeft'||e.key==='a'){ sel = (sel-1+keys.length)%keys.length; highlightItem(sel); }
    if(e.key==='ArrowRight'||e.key==='d'){ sel = (sel+1)%keys.length; highlightItem(sel); }
    if(e.key==='Enter'||e.key===' '){
      document.removeEventListener('keydown', nav);
      const key = keys[sel];
      if(items[key].count<=0){ setDialogue("You don't have that item.", 700); itemRow.classList.add('hidden'); setTimeout(()=>startEnemyAttack(),700); return; }
      items[key].count -= 1;
      const heal = items[key].heal;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      updateHPUI(0);
      bullets.push({isText:true,text:`+${heal} HP!`,x:520,y:540,color:'lime',life:80});
      healSfx.currentTime=0; safePlay(healSfx);
      itemRow.classList.add('hidden');
      setTimeout(()=>startEnemyAttack(),700);
    }
    if(e.key==='Escape'){ document.removeEventListener('keydown', nav); itemRow.classList.add('hidden'); setDialogue("You close your inventory.", 400); setTimeout(()=>startEnemyAttack(),700); }
  }
  document.addEventListener('keydown', nav);
}

// enemy attack patterns
function startEnemyAttack(){
  inAttackSequence = true;
  bullets = bullets.filter(b=>b.isText);
  const pattern = Math.floor(Math.random()*3);
  if(pattern===0){ for(let i=0;i<22;i++){ const ang=(Math.random()*1.6)-0.8; const sp=2+Math.random()*2; bullets.push({x:480,y:120,vx:Math.sin(ang)*sp,vy:Math.cos(ang)*sp,r:6}); } }
  else if(pattern===1){ for(let i=0;i<18;i++){ bullets.push({x:Math.random()*720+120,y:-20+Math.random()*40,vx:0,vy:3+Math.random()*1.5,r:5}); } }
  else { const cx=480,cy=120; for(let i=0;i<26;i++){ const a=i*0.3; const sp=1.8+(i%5)*0.2; bullets.push({x:cx+Math.cos(a)*8,y:cy+Math.sin(a)*8,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:5}); } }
  attackSfx.currentTime=0; safePlay(attackSfx);
  dialogueBox.style.width='360px';
  player.soulX=480; player.soulY=480; soul.style.left=(player.soulX-12)+'px'; soul.style.top=(player.soulY-12)+'px';
  setTimeout(()=>{ inAttackSequence=false; bullets = bullets.filter(b=>b.isText); dialogueBox.style.width='720px'; setDialogue("Choose an action."); highlightButton(0); stats.rounds += 1; }, 3000);
}

// apply bullets hits
function applyBulletHits(){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    if(b.isText) continue;
    b.x += b.vx; b.y += b.vy;
    const dx=b.x-player.soulX, dy=b.y-player.soulY; const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist < (b.r + player.size/2)){ bullets.splice(i,1); const dmg=30; player.hp=Math.max(0,player.hp-dmg); bullets.push({isText:true,text:`-${dmg}`,x:player.soulX,y:player.soulY-20,color:'crimson',life:90}); hitSfx.currentTime=0; safePlay(hitSfx); updateHPUI(dmg); if(player.hp<=0){ stats.deaths+=1; setDialogue("You died. Game over.",1200); setTimeout(()=>showScreen(STATE.MENU),1400); } }
    if(b.x<0||b.x>960||b.y<-50||b.y>900) bullets.splice(i,1);
  }
}

// render loop
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw bullets/text
  ctx.fillStyle='#fff'; for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; if(b.isText){ ctx.fillStyle=b.color||'#fff'; ctx.font="14px 'Press Start 2P',monospace"; ctx.fillText(b.text,b.x,b.y); b.y -= 0.6; b.life--; if(b.life<=0) bullets.splice(i,1); } else { ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); } }
  applyBulletHits();
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// slider loop drawing
function sliderLoop(){ if(sliderActive){ sliderCtx.clearRect(0,0,sliderCanvas.width,sliderCanvas.height); const w=sliderCanvas.width-60; sliderPos += sliderDir*6; if(sliderPos<=0){ sliderPos=0; sliderDir=1; } if(sliderPos>=w-8){ sliderPos=w-8; sliderDir=-1; } sliderCtx.fillStyle='#222'; sliderCtx.fillRect(30,10,w,28); const centerX=30+w/2; sliderCtx.fillStyle='#333'; sliderCtx.fillRect(centerX-18,10,36,28); sliderCtx.fillStyle='#fff'; sliderCtx.fillRect(30+sliderPos,10,8,28); } requestAnimationFrame(sliderLoop); } requestAnimationFrame(sliderLoop);

// helpers and init
function updateHPUI(dmg){ hpCurEl.textContent=player.hp; hpMaxEl.textContent=player.maxHp; const pct=Math.max(0,player.hp/player.maxHp); hpBar.style.width=(pct*100)+'%'; if(dmg>0){ const lostPct=Math.min(1,dmg/player.maxHp); hpLost.style.width=(lostPct*100)+'%'; hpLost.style.opacity='0.9'; setTimeout(()=>{ hpLost.style.opacity='0'; hpLost.style.width='0'; },600); } }
function highlightButton(idx){ actionBtns.forEach((b,i)=>b.classList.toggle('selected',i===idx)); const rect=actionBtns[idx].getBoundingClientRect(); const parentRect=actionBtns[idx].parentElement.getBoundingClientRect(); soul.style.left=(rect.left-parentRect.left+60)+'px'; soul.style.top=(rect.top-parentRect.top-30)+'px'; safePlay(boopSfx); }
function setDialogue(t,s=24,c=0){ // typing
  if(window._typing) clearTimeout(window._typing);
  dialogueText.textContent=''; let i=0; function next(){ if(i<t.length){ dialogueText.textContent += t[i]; tickSfx.currentTime=0; safePlay(tickSfx); i++; window._typing=setTimeout(next,s); } else { window._typing=null; if(c>0) setTimeout(()=>{ dialogueText.textContent=''; },c); } } next(); }
showScreen(STATE.MENU);
updateHPUI(0);
