
// Wundo Juggerbash v4 - fixed & audio
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// State
let state = 'menu'; // menu, dialogue, attackBox, enemyTurn
let selected = 0; // 0..3 buttons
const buttons = ['FIGHT','ACT','ITEM','MERCY'];

// Player & enemy
let player = { hp:310, maxHp:400, x: W/2, y: H-120, size:24 };
let enemy = { hp:940, maxHp:940, jailed:false };

// UI text
let flavor = "The Juggernaut watches you.";
let actMsgs = [
  "The Juggernaut watches you.",
  "He cracks his knuckles.",
  "The Juggernaut adjusts his hat."
];
let actIdx = 0;

// Attack bullets
let bullets = [];
let attackTimer = 0;

// floating texts
let floats = [];

// Audio
const boop = new Audio('assets/audio/boop.wav');
const confirm = new Audio('assets/audio/confirm.wav');
const healS = new Audio('assets/audio/heal.wav');
const battle = new Audio('assets/audio/battle_theme.wav');
battle.loop = true;

// helper safe play
function safePlay(a){
  if(!a) return;
  a.currentTime = 0;
  const p = a.play();
  if(p && p.catch) p.catch(()=>{});
}

// input
window.addEventListener('keydown', (ev) => {
  const k = ev.key;
  if(state === 'attackBox') {
    // move soul within attack box (square centered)
    const box = getAttackBox();
    if(k==='ArrowLeft' || k==='a') player.x = Math.max(box.x+6, player.x-12);
    if(k==='ArrowRight' || k==='d') player.x = Math.min(box.x+box.w-6, player.x+12);
    if(k==='ArrowUp' || k==='w') player.y = Math.max(box.y+6, player.y-12);
    if(k==='ArrowDown' || k==='s') player.y = Math.min(box.y+box.h-6, player.y+12);
    return;
  }
  // menu navigation when not in attack
  if(k==='ArrowLeft' || k==='a'){ selected = (selected-1+buttons.length)%buttons.length; safePlay(boop); }
  if(k==='ArrowRight' || k==='d'){ selected = (selected+1)%buttons.length; safePlay(boop); }
  if(k==='Enter' || k===' '){ safePlay(confirm); activateButton(); }
});

function activateButton(){
  const b = buttons[selected];
  if(state==='menu' || state==='dialogue'){
    if(b==='FIGHT') {
      // show slider simplified: immediate partial damage then enemy attacks
      const dmg = Math.random() < 0.5 ? 20 : 7;
      enemy.hp = Math.max(0, enemy.hp - dmg);
      flavor = `You attacked! -${dmg} HP`;
      if(enemy.hp===0){ enemy.jailed = true; flavor = "The Juggernaut is subdued."; }
      // start battle music if not playing
      if(battle.paused) safePlay(battle);
      // next: enemy turn after delay
      setTimeout(()=> startEnemyTurn(), 700);
      state='dialogue';
    } else if(b==='ACT') {
      flavor = actMsgs[actIdx];
      actIdx = (actIdx+1) % actMsgs.length;
      setTimeout(()=> startEnemyTurn(), 700);
      state='dialogue';
    } else if(b==='ITEM') {
      const heal = 50;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      floats.push({txt:'+'+heal+' HP!', x: W/2, y: H-180, life:60, color:'lime'});
      safePlay(healS);
      setTimeout(()=> startEnemyTurn(), 700);
      state='dialogue';
    } else if(b==='MERCY') {
      flavor = "You spared the Juggernaut. The Juggernaut has not spared you.";
      setTimeout(()=> startEnemyTurn(), 700);
      state='dialogue';
    }
  }
}

// Attack box calculation
function getAttackBox(){
  // centered square above bottom area
  const w = 200, h=200;
  const x = (W-w)/2, y = H-250;
  return {x,y,w,h};
}

// Enemy attack patterns
function startEnemyTurn(){
  // begin attack box mode
  bullets = [];
  attackTimer = 0;
  state = 'attackBox';
  // pick pattern
  const p = Math.floor(Math.random()*3);
  if(p===0) patternSpray();
  else if(p===1) patternRain();
  else patternSpiral();
  // after 3s, end attack
  setTimeout(()=>{ state='menu'; bullets=[]; }, 3000);
}

function patternSpray(){
  const cx = W/2, cy=120;
  for(let i=0;i<20;i++){
    const angle = Math.random()*Math.PI*2;
    const speed = 1.5 + Math.random()*2.0;
    bullets.push({x:cx,y:cy,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:5});
  }
}
function patternRain(){
  for(let i=0;i<18;i++){
    bullets.push({x:Math.random()*W, y:90 + Math.random()*60, vx:0, vy:2.5 + Math.random()*1.0, r:5});
  }
}
function patternSpiral(){
  const cx=W/2, cy=120;
  for(let i=0;i<24;i++){
    const a = i*0.4;
    const speed = 1.2 + (i%4)*0.2;
    bullets.push({x:cx + Math.cos(a)*10, y:cy + Math.sin(a)*10, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, r:5});
  }
}

// update and render
function update(dt){
  // move bullets
  if(bullets.length){
    for(let b of bullets){
      b.x += b.vx*dt;
      b.y += b.vy*dt;
      // collision with player soul (circle vs circle)
      const dx = b.x - player.x, dy = b.y - player.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if(dist < b.r + player.size/2){
        // hit once and remove ball by moving offscreen
        b.x = -1000;
        // damage
        const dmg = 30;
        player.hp = Math.max(0, player.hp - dmg);
        floats.push({txt:'-'+dmg, x: player.x, y: player.y-20, life:50, color:'red'});
        // flash red damage overlay by pushing a float with special flag
      }
    }
    bullets = bullets.filter(b=>b.x>-50 && b.x < W+50 && b.y > -50 && b.y < H+50);
  }
  // floats lifecycle
  for(let f of floats){ f.y -= 0.6*dt; f.life -= 1*dt; }
  floats = floats.filter(f=>f.life>0);
}

let last=performance.now();
function loop(ts){
  const dt = (ts-last)/16.67; last=ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function render(){
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  // draw enemy area (sprite placeholder)
  ctx.fillStyle='#222'; ctx.fillRect((W-480)/2,20,480,220);
  ctx.strokeStyle='#fff'; ctx.strokeRect((W-480)/2,20,480,220);
  // draw enemy tall sprite placeholder
  ctx.strokeStyle='#fff'; ctx.lineWidth=2;
  ctx.strokeRect(W/2-120,40,240,300);
  // dialogue / action box
  if(state==='attackBox'){
    const box = getAttackBox();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    // draw soul inside box
    ctx.fillStyle='red'; ctx.beginPath(); ctx.arc(player.x, player.y, player.size/2,0,Math.PI*2); ctx.fill();
    // projectiles white
    ctx.fillStyle='white';
    for(let b of bullets){ ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); }
  } else {
    // big dialogue box
    ctx.strokeStyle='#fff'; ctx.lineWidth=2;
    ctx.strokeRect(40, H-200, W-80, 120);
    ctx.fillStyle='#fff'; ctx.font='14px monospace';
    ctx.fillText(flavor, 60, H-160);
    // HP bar between box and buttons
    const hpY = H-80;
    ctx.fillStyle='#fff'; ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, 60, hpY);
    // background bar
    ctx.strokeStyle='#fff'; ctx.strokeRect(150, hpY-14, 300, 14);
    // yellow fill
    const w = Math.max(0, 300*(player.hp/player.maxHp));
    ctx.fillStyle='yellow'; ctx.fillRect(150, hpY-14, w, 14);
    // red damage overlay not implemented here beyond floats
  }
  // floating texts
  for(let f of floats){ ctx.fillStyle = f.color; ctx.font='13px monospace'; ctx.fillText(f.txt, f.x, f.y); }
  // buttons row
  const by = H-40;
  let bx = 60;
  for(let i=0;i<buttons.length;i++){
    ctx.strokeStyle = (i===selected)? 'yellow' : 'orange';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, 120, 30);
    ctx.fillStyle='white';
    ctx.font='14px monospace';
    ctx.fillText(buttons[i], bx+14, by+20);
    bx += 140;
  }
}

// start
requestAnimationFrame(loop);
