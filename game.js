/* ══════════════════════════════════════════
   VOID PROTOCOL — Game Engine
   Full roguelike systems: map, enemies, bosses,
   weapons, upgrades, dash, particles, minimap
══════════════════════════════════════════ */

'use strict';

// ── CANVAS SETUP ──────────────────────────
const canvas  = document.getElementById('game-canvas');
const ctx     = canvas.getContext('2d');
const mmCv    = document.getElementById('minimap-canvas');
const mm      = mmCv.getContext('2d');

const TILE = 32, MAP_W = 90, MAP_H = 68;

function resizeCanvas() {
  const a = document.getElementById('canvas-area');
  const w = a.offsetWidth  || window.innerWidth;
  const h = a.offsetHeight || Math.max(200, window.innerHeight - 46 - 22 - 160 - 8);
  canvas.width  = Math.max(w, 50);
  canvas.height = Math.max(h, 50);
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); });
window.addEventListener('orientationchange', () => { setTimeout(resizeCanvas, 200); });

// ── CONSTANTS ─────────────────────────────
const WEAPON_TYPES = {
  PULSE:   { name:'PULSE',   icon:'●', color:'#00fff7', rof:18, spd:6.5,  dmg:18, range:75, spread:0,   count:1, pierce:false, desc:'Standard rapid fire'   },
  BURST:   { name:'BURST',   icon:'⦿', color:'#00aaff', rof:30, spd:7,    dmg:14, range:65, spread:.15, count:3, pierce:false, desc:'3-round burst'         },
  SCATTER: { name:'SCATTER', icon:'❋', color:'#ff8800', rof:25, spd:5.5,  dmg:10, range:55, spread:.28, count:5, pierce:false, desc:'5-way shotgun spread'  },
  LASER:   { name:'LASER',   icon:'━', color:'#ff00cc', rof:40, spd:9,    dmg:28, range:90, spread:0,   count:1, pierce:true,  desc:'Piercing long range'   },
  NOVA:    { name:'NOVA',    icon:'✦', color:'#cc00ff', rof:60, spd:4,    dmg:35, range:50, spread:.5,  count:8, pierce:false, desc:'8-way burst explosion' },
};

const ENEMY_DEFS = [
  { id:'CHASER',   color:'#ff003c', size:10, hp:30,  spd:1.5, dmg:10, xp:3,  score:100, fire:0,   shape:'tri'  },
  { id:'SHOOTER',  color:'#ff8800', size:9,  hp:22,  spd:0.9, dmg:8,  xp:4,  score:150, fire:80,  shape:'dia'  },
  { id:'TANK',     color:'#cc00ff', size:15, hp:110, spd:0.7, dmg:15, xp:8,  score:300, fire:0,   shape:'hex'  },
  { id:'SPEEDER',  color:'#00ffcc', size:7,  hp:15,  spd:3.0, dmg:6,  xp:2,  score:80,  fire:0,   shape:'arrow'},
  { id:'SNIPER',   color:'#ffee00', size:8,  hp:18,  spd:0.5, dmg:25, xp:6,  score:200, fire:120, shape:'cross'},
  { id:'SPLITTER', color:'#ff6600', size:12, hp:50,  spd:1.1, dmg:12, xp:7,  score:250, fire:0,   shape:'sq',   splits:true },
  { id:'GHOST',    color:'#aaaaff', size:9,  hp:20,  spd:1.8, dmg:9,  xp:5,  score:180, fire:60,  shape:'dia',  ghost:true  },
  { id:'BOMBER',   color:'#ff4400', size:11, hp:40,  spd:1.3, dmg:30, xp:9,  score:350, fire:0,   shape:'hex',  bomber:true },
];

const BOSS_DEFS = [
  { name:'APEX PROCESS',  color:'#ff003c', size:28, hp:600,  spd:1.2, dmg:20, score:2000, phase2Hp:300,
    attacks:['spin','charge','spread'], desc:'First guardian of the void' },
  { name:'VOID SENTINEL', color:'#cc00ff', size:32, hp:900,  spd:0.9, dmg:25, score:3500, phase2Hp:450,
    attacks:['laser','summon','nova'],   desc:'Ancient network watchdog'  },
  { name:'DATA WRAITH',   color:'#00ffcc', size:24, hp:750,  spd:2.0, dmg:18, score:3000, phase2Hp:375,
    attacks:['teleport','burst','wall'], desc:'Corrupted data phantom'    },
  { name:'NULL CORE',     color:'#ffee00', size:36, hp:1200, spd:0.6, dmg:30, score:5000, phase2Hp:600,
    attacks:['orbit','beam','explode'], desc:'The core of the void itself'},
];

const ALL_UPGRADES = [
  // Common
  { tier:'C', icon:'⚡', name:'OVERCLOCK',   color:'#00fff7',  desc:'Fire rate +30%',          fn:p=>{p.fireRate=Math.max(5,~~(p.fireRate*.70));} },
  { tier:'C', icon:'🔴', name:'VELOCITY+',   color:'#ff6644',  desc:'Move speed +20%',         fn:p=>{p.speed*=1.20;} },
  { tier:'C', icon:'🔋', name:'REGEN',        color:'#00ff88',  desc:'Restore 40 HP now',       fn:p=>{p.hp=Math.min(p.maxHp,p.hp+40);} },
  { tier:'C', icon:'💛', name:'PAYLOAD+',    color:'#ffcc00',  desc:'Bullet damage +20%',      fn:p=>{p.bulletDmg=~~(p.bulletDmg*1.20);} },
  { tier:'C', icon:'🔵', name:'MAX HP+',     color:'#4488ff',  desc:'Max HP +40',              fn:p=>{p.maxHp+=40;p.hp=Math.min(p.maxHp,p.hp+20);} },
  { tier:'C', icon:'🟢', name:'RANGE+',      color:'#00ff88',  desc:'Bullet range +25%',       fn:p=>{p.bulletRange=~~(p.bulletRange*1.25);} },
  // Rare
  { tier:'R', icon:'🌀', name:'SPREAD',       color:'#ff00cc',  desc:'Fire +2 bullets',         fn:p=>{p.bulletCount=Math.min(p.bulletCount+2,7);} },
  { tier:'R', icon:'💫', name:'PIERCING',     color:'#ff00cc',  desc:'Bullets pierce enemies',  fn:p=>{p.piercing=true;} },
  { tier:'R', icon:'🛡️', name:'SHIELD CORE', color:'#0088ff',  desc:'Gain 50 shield HP',       fn:p=>{p.maxShield+=50;p.shield=Math.min(p.maxShield,p.shield+50);} },
  { tier:'R', icon:'⚗️', name:'DUAL FIRE',   color:'#ff00cc',  desc:'Alternate angle shots',   fn:p=>{p.dualFire=true;} },
  { tier:'R', icon:'🔮', name:'HASTE',        color:'#cc00ff',  desc:'Bullet speed +35%',       fn:p=>{p.bulletSpeed*=1.35;} },
  { tier:'R', icon:'💣', name:'HEAVY ROUNDS', color:'#ff8800',  desc:'Dmg +40%, rate -15%',     fn:p=>{p.bulletDmg=~~(p.bulletDmg*1.4);p.fireRate=~~(p.fireRate*1.15);} },
  // Epic
  { tier:'E', icon:'☄️', name:'BURST NOVA',  color:'#ffee00',  desc:'Switch weapon: NOVA',     fn:(p,g)=>{g.setWeapon('NOVA');} },
  { tier:'E', icon:'🔫', name:'SCATTER SYS', color:'#ff8800',  desc:'Switch weapon: SCATTER',  fn:(p,g)=>{g.setWeapon('SCATTER');} },
  { tier:'E', icon:'🌊', name:'LASER CORE',  color:'#ff00cc',  desc:'Switch weapon: LASER',    fn:(p,g)=>{g.setWeapon('LASER');} },
  { tier:'E', icon:'⚡', name:'BURST FIRE',  color:'#00aaff',  desc:'Switch weapon: BURST',    fn:(p,g)=>{g.setWeapon('BURST');} },
  { tier:'E', icon:'💎', name:'OVERDRIVE',   color:'#ffee00',  desc:'Fire rate -50% now',      fn:p=>{p.fireRate=Math.max(4,~~(p.fireRate*.5));p.bulletDmg=~~(p.bulletDmg*1.5);} },
  { tier:'E', icon:'🧬', name:'EVOLUTION X', color:'#00ffcc',  desc:'+Max HP, +Speed, +Dmg',   fn:p=>{p.maxHp+=30;p.speed*=1.1;p.bulletDmg=~~(p.bulletDmg*1.1);p.hp=Math.min(p.maxHp,p.hp+30);} },
];

// ── STATE ─────────────────────────────────
let game, input, highScore = { score:0, wave:0, kills:0 };

// Load high score
try {
  const hs = JSON.parse(localStorage.getItem('vp_hs') || '{}');
  if(hs.score) highScore = hs;
} catch(e){}

function saveHS() {
  try { localStorage.setItem('vp_hs', JSON.stringify(highScore)); } catch(e) {}
}

function updateHSDisplay() {
  document.getElementById('hs-score').textContent = String(highScore.score).padStart(6,'0');
  document.getElementById('hs-wave').textContent  = String(highScore.wave).padStart(2,'0');
  document.getElementById('hs-kills').textContent = String(highScore.kills).padStart(3,'0');
}
updateHSDisplay();

function initInput() {
  input = { move:{x:0,y:0}, fire:{x:0,y:0,active:false}, keys:{}, dash:false };
}

function initGame() {
  game = {
    running:false, paused:false,
    wave:1, kills:0, score:0, t:0, combo:0, comboTimer:0,
    waveTimer:0, waveDelay:200, betweenWaves:false,
    bossActive:false, boss:null,
    map:[], rooms:[],
    player:null, camera:{x:0,y:0},
    bullets:[], eBullets:[], enemies:[],
    particles:[], pickups:[],
    floatingTexts:[],
    statusTimer:0,
    currentWeapon:'PULSE',
    buffs:[],
  };
}

// ── MAP GENERATION ────────────────────────
function generateMap() {
  const map = Array.from({length:MAP_H}, () => Array(MAP_W).fill(1));
  const rooms = [];

  for(let i = 0; i < 100; i++) {
    const rw = 5 + ~~(Math.random()*10);
    const rh = 4 + ~~(Math.random()*8);
    const rx = 1 + ~~(Math.random()*(MAP_W-rw-2));
    const ry = 1 + ~~(Math.random()*(MAP_H-rh-2));
    if(rooms.some(r => rx<r.x+r.w+2 && rx+rw+2>r.x && ry<r.y+r.h+2 && ry+rh+2>r.y)) continue;
    for(let y=ry; y<ry+rh; y++)
      for(let x=rx; x<rx+rw; x++)
        map[y][x] = 0;
    rooms.push({x:rx,y:ry,w:rw,h:rh,cx:~~(rx+rw/2),cy:~~(ry+rh/2)});
  }

  // Connect rooms
  const connected = [rooms[0]];
  const unconnected = rooms.slice(1);
  while(unconnected.length) {
    let best = null, bestDist = Infinity, bestFrom = null;
    for(const u of unconnected) {
      for(const c of connected) {
        const d = Math.hypot(u.cx-c.cx, u.cy-c.cy);
        if(d < bestDist) { bestDist=d; best=u; bestFrom=c; }
      }
    }
    if(best) {
      let x=bestFrom.cx, y=bestFrom.cy;
      while(x!==best.cx){ map[y][x]=0; x+=x<best.cx?1:-1; }
      while(y!==best.cy){ map[y][x]=0; y+=y<best.cy?1:-1; }
      connected.push(best);
      unconnected.splice(unconnected.indexOf(best),1);
    }
  }

  // Add some decorative pillars inside rooms
  rooms.forEach(r => {
    if(r.w>=8 && r.h>=7 && Math.random()<0.4) {
      map[r.y+2][r.x+2] = 1;
      map[r.y+2][r.x+r.w-3] = 1;
      map[r.y+r.h-3][r.x+2] = 1;
      map[r.y+r.h-3][r.x+r.w-3] = 1;
    }
  });

  return {map,rooms};
}

// ── PLAYER ────────────────────────────────
function mkPlayer(x, y) {
  return {
    x, y, vx:0, vy:0,
    w:14, h:14,
    hp:100, maxHp:100,
    shield:0, maxShield:0,
    shieldRegen:0, shieldRegenCd:0,
    speed:2.4,
    xp:0, xpNext:12,
    level:1,
    fireRate:18, fireCd:0,
    bulletSpeed:6.5, bulletDmg:18,
    bulletCount:1, bulletRange:75,
    piercing:false, dualFire:false,
    invFrames:0, angle:0,
    trail:[],
    dashCd:0, dashMaxCd:90, dashForce:0,
    dashDx:0, dashDy:0,
    totalDamageTaken:0, totalDamageDealt:0,
  };
}

// ── WEAPON ────────────────────────────────
game = { currentWeapon:'PULSE' };
function setWeapon(id) {
  game.currentWeapon = id;
  const w = WEAPON_TYPES[id];
  game.player.fireRate    = w.rof;
  game.player.bulletSpeed = w.spd;
  game.player.bulletRange = w.range;
  document.getElementById('wep-icon').textContent = w.icon;
  document.getElementById('wep-name').textContent  = w.name;
}
game.setWeapon = setWeapon;

// ── TILE COLLISION ────────────────────────
function tAt(wx, wy) {
  const tx=~~(wx/TILE), ty=~~(wy/TILE);
  if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) return 1;
  return game.map[ty][tx];
}
function moveE(e, vx, vy, hw=10, hh=10) {
  if(tAt(e.x+vx-hw,e.y-hh)===0 && tAt(e.x+vx+hw,e.y-hh)===0 &&
     tAt(e.x+vx-hw,e.y+hh)===0 && tAt(e.x+vx+hw,e.y+hh)===0) e.x+=vx;
  if(tAt(e.x-hw,e.y+vy-hh)===0 && tAt(e.x+hw,e.y+vy-hh)===0 &&
     tAt(e.x-hw,e.y+vy+hh)===0 && tAt(e.x+hw,e.y+vy+hh)===0) e.y+=vy;
}

// ── PARTICLES ─────────────────────────────
function spark(x, y, color, n=8, s=2.5, gravity=false) {
  for(let i=0;i<n;i++) {
    const a=Math.random()*Math.PI*2, sp=s*(.4+Math.random()*.8);
    game.particles.push({
      x, y,
      vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      life:25+~~(Math.random()*25), maxLife:50,
      color, r:1.5+Math.random()*2.5,
      gravity,
    });
  }
}

function floatText(x, y, text, color='#ffffff') {
  game.floatingTexts.push({x, y, text, color, life:50, maxLife:50, vy:-0.8});
}

// ── ENEMY CREATION ────────────────────────
function mkEnemy(typeId, wave) {
  const r = game.rooms[~~(Math.random()*game.rooms.length)];
  const def = ENEMY_DEFS[typeId];
  const a = Math.random()*Math.PI*2, d = 100+Math.random()*80;
  const hpScale = 1 + (wave-1)*0.12;
  return {
    ...def, id:def.id,
    x: r.cx*TILE+Math.cos(a)*d, y: r.cy*TILE+Math.sin(a)*d,
    vx:0, vy:0,
    maxHp: ~~(def.hp * hpScale),
    hp:    ~~(def.hp * hpScale),
    fireCd: ~~(Math.random()*Math.max(def.fire,1)),
    flashTimer:0, angle:0, wobble:Math.random()*Math.PI*2,
    alive:true, ghost:def.ghost||false,
    splits:def.splits||false, bomber:def.bomber||false,
    splitDone:false,
  };
}

// ── BOSS CREATION ─────────────────────────
function mkBoss(idx) {
  const def = BOSS_DEFS[idx % BOSS_DEFS.length];
  const r = game.rooms[~~(game.rooms.length/2)];
  return {
    ...def,
    x: r.cx*TILE, y: r.cy*TILE,
    vx:0, vy:0,
    hp: def.hp, maxHp: def.hp,
    phase:1, phaseChanged:false,
    alive:true, angle:0, wobble:0,
    flashTimer:0, fireCd:0,
    attackTimer:0, attackState:'idle',
    spinBullets:0,
    chargeTarget:{x:0,y:0}, chargeDx:0, chargeDy:0,
    orbitBullets:[],
  };
}

// ── PICKUPS ───────────────────────────────
const PICKUP_TYPES = ['hp','hp','xp','xp','shield','weapon_token'];
function mkPickup(x, y, force) {
  const type = force || PICKUP_TYPES[~~(Math.random()*PICKUP_TYPES.length)];
  return { x, y, type, life:400, pulse:0 };
}

// ── WAVES ─────────────────────────────────
function getWaveConfig(wave) {
  const isBossWave = wave % 5 === 0;
  const count = 5 + wave*2;
  let types = [0]; // always start with chasers
  if(wave >= 2) types.push(3);
  if(wave >= 3) types.push(1);
  if(wave >= 4) types.push(5);
  if(wave >= 5) types.push(2);
  if(wave >= 6) types.push(6);
  if(wave >= 7) types.push(4);
  if(wave >= 8) types.push(7);
  return {count, types, isBossWave};
}

function startWave() {
  game.betweenWaves = false;
  game.bossActive = false;
  game.boss = null;
  document.getElementById('boss-hud').classList.add('hidden');
  game.enemies = []; game.bullets = []; game.eBullets = [];

  const cfg = getWaveConfig(game.wave);

  if(cfg.isBossWave) {
    showBossWarning(game.wave);
    return;
  }

  for(let i=0; i<cfg.count; i++) {
    const t = cfg.types[~~(Math.random()*cfg.types.length)];
    game.enemies.push(mkEnemy(t, game.wave));
  }
  setStatus(`[ WAVE ${game.wave} INITIATED — ${cfg.count} PROCESSES ]`, 150);
}

function spawnBoss() {
  game.bossActive = true;
  const bIdx = ~~(game.wave/5) - 1;
  game.boss = mkBoss(bIdx);
  const bDef = BOSS_DEFS[bIdx % BOSS_DEFS.length];
  document.getElementById('boss-hud').classList.remove('hidden');
  document.getElementById('boss-name-hud').textContent = bDef.name;
  setStatus(`[ ${bDef.name} MANIFESTATION DETECTED ]`, 200);
}

function showBossWarning(wave) {
  const bIdx = ~~(wave/5) - 1;
  const bDef = BOSS_DEFS[bIdx % BOSS_DEFS.length];
  document.getElementById('bw-name').textContent = bDef.name;
  showScreen('boss-warning');
  setTimeout(() => {
    hideScreen('boss-warning');
    spawnBoss();
  }, 3000);
}

function setStatus(msg, dur=90) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.classList.add('visible');
  game.statusTimer = dur;
}

// ── UPDATE ────────────────────────────────
function update() {
  if(!game.running || game.paused) return;
  game.t++;

  if(game.statusTimer > 0 && --game.statusTimer === 0)
    document.getElementById('status-msg').classList.remove('visible');

  if(game.betweenWaves) {
    if(++game.waveTimer >= game.waveDelay) startWave();
    return;
  }

  updatePlayer();
  updateBullets();
  updateEBullets();
  updateEnemies();
  if(game.bossActive && game.boss?.alive) updateBoss();
  updatePickups();
  updateParticles();
  updateFloatingTexts();
  updateDashBtn();
  updateHUD();
}

// ── PLAYER UPDATE ─────────────────────────
function updatePlayer() {
  const p = game.player;

  // Dash movement
  if(p.dashForce > 0) {
    moveE(p, p.dashDx * p.dashForce, p.dashDy * p.dashForce, 7, 7);
    p.dashForce -= 0.6;
    spark(p.x, p.y, '#00fff7', 2, 1.5);
    return;
  }

  // Normal movement
  let dx = input.move.x, dy = input.move.y;
  if(input.keys['w']||input.keys['ArrowUp'])    dy=-1;
  if(input.keys['s']||input.keys['ArrowDown'])  dy= 1;
  if(input.keys['a']||input.keys['ArrowLeft'])  dx=-1;
  if(input.keys['d']||input.keys['ArrowRight']) dx= 1;
  const len = Math.sqrt(dx*dx+dy*dy);
  if(len>0.01) {
    if(len>1){ dx/=len; dy/=len; }
    moveE(p, dx*p.speed, dy*p.speed, 7, 7);
  }

  // Aim angle
  if(input.fire.active && (Math.abs(input.fire.x)>.05||Math.abs(input.fire.y)>.05))
    p.angle = Math.atan2(input.fire.y, input.fire.x);
  else if(len>.05)
    p.angle = Math.atan2(dy, dx);

  // Trail
  p.trail.unshift({x:p.x, y:p.y});
  if(p.trail.length>10) p.trail.pop();

  // Shoot
  if(p.fireCd>0) p.fireCd--;
  const shooting = input.fire.active || input.keys[' '] || input.keys['z'] || input.keys['Enter'];
  if(shooting && p.fireCd===0) shootPlayer();

  // Dash
  if(input.dash && p.dashCd===0) {
    if(len>0.05) { p.dashDx=dx/len; p.dashDy=dy/len; }
    else { p.dashDx=Math.cos(p.angle); p.dashDy=Math.sin(p.angle); }
    p.dashForce = 7; p.dashCd = p.dashMaxCd;
    p.invFrames = 25;
    spark(p.x, p.y, '#00fff7', 20, 3);
    input.dash = false;
  }
  if(p.dashCd>0) p.dashCd--;

  // Shield regen
  if(p.maxShield>0 && p.shield < p.maxShield) {
    if(++p.shieldRegenCd >= 180) {
      p.shield = Math.min(p.maxShield, p.shield+1);
      p.shieldRegenCd = 160;
    }
  }

  if(p.invFrames>0) p.invFrames--;

  // Camera
  game.camera.x += (p.x - canvas.width/2  - game.camera.x) * .12;
  game.camera.y += (p.y - canvas.height/2 - game.camera.y) * .12;
}

function shootPlayer() {
  const p = game.player;
  p.fireCd = p.fireRate;
  const w = WEAPON_TYPES[game.currentWeapon];
  const spread = (p.bulletCount-1) * (w.spread || 0.18);

  for(let i=0; i<p.bulletCount; i++) {
    const baseA = p.bulletCount===1 ? p.angle :
      (p.angle - spread/2 + i*(spread/Math.max(p.bulletCount-1,1)));

    game.bullets.push({
      x:p.x, y:p.y,
      vx:Math.cos(baseA)*p.bulletSpeed,
      vy:Math.sin(baseA)*p.bulletSpeed,
      dmg:p.bulletDmg, piercing:p.piercing,
      color:w.color, life:~~(p.bulletRange*1.2), r:4,
      trail:[], owner:'player',
    });
  }

  // Dual fire offset
  if(p.dualFire) {
    const perpA = p.angle + Math.PI/2;
    const offX = Math.cos(perpA)*6, offY = Math.sin(perpA)*6;
    game.bullets.push({
      x:p.x+offX, y:p.y+offY,
      vx:Math.cos(p.angle)*p.bulletSpeed,
      vy:Math.sin(p.angle)*p.bulletSpeed,
      dmg:~~(p.bulletDmg*.7), piercing:p.piercing,
      color:w.color+'aa', life:~~(p.bulletRange*0.9), r:3,
      trail:[], owner:'player',
    });
  }

  spark(p.x+Math.cos(p.angle)*14, p.y+Math.sin(p.angle)*14, w.color, 3, 1.5);
}

// ── BULLETS UPDATE ────────────────────────
function updateBullets() {
  game.bullets = game.bullets.filter(b => {
    b.trail.unshift({x:b.x, y:b.y});
    if(b.trail.length>6) b.trail.pop();
    b.x+=b.vx; b.y+=b.vy; b.life--;
    if(b.life<=0 || tAt(b.x,b.y)===1) {
      spark(b.x,b.y,b.color,3,1);
      return false;
    }

    let hit = false;

    // Hit enemies
    game.enemies.forEach(e => {
      if(!e.alive || hit) return;
      if(e.ghost && Math.random()<.4) return; // ghost dodge
      if(Math.hypot(b.x-e.x, b.y-e.y) < e.size+b.r) {
        damageEnemy(e, b.dmg, b.color);
        if(!b.piercing) hit=true;
      }
    });

    // Hit boss
    if(game.bossActive && game.boss?.alive && !hit) {
      if(Math.hypot(b.x-game.boss.x, b.y-game.boss.y) < game.boss.size+b.r) {
        damageBoss(b.dmg);
        if(!b.piercing) hit=true;
      }
    }

    return !hit;
  });
}

function damageEnemy(e, dmg, color) {
  e.hp -= dmg;
  e.flashTimer = 6;
  game.player.totalDamageDealt += dmg;
  spark(e.x, e.y, e.color, 5, 2);
  floatText(e.x, e.y-e.size, dmg, color);

  if(e.hp <= 0) {
    e.alive = false;
    game.kills++;
    game.score += e.score * (1 + ~~(game.combo*.1));
    game.player.xp += e.xp;
    game.combo++;
    game.comboTimer = 120;
    spark(e.x, e.y, e.color, 18, 3.5, true);

    if(e.splits && !e.splitDone) {
      for(let i=0;i<3;i++) {
        const mini = mkEnemy(0, game.wave);
        mini.x=e.x; mini.y=e.y; mini.size=6; mini.hp=12; mini.maxHp=12; mini.score=30;
        game.enemies.push(mini);
      }
    }

    if(e.bomber) {
      // Explosion
      for(let i=0;i<360;i+=30) {
        const a = i*Math.PI/180;
        game.eBullets.push({x:e.x,y:e.y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,
          dmg:15,r:5,life:40,color:'#ff4400'});
      }
      spark(e.x,e.y,'#ff4400',30,5);
    }

    const dropChance = e.boss ? 1 : 0.3;
    if(Math.random() < dropChance)
      game.pickups.push(mkPickup(e.x, e.y));
  }
}

function damageBoss(dmg) {
  const b = game.boss;
  b.hp -= dmg;
  b.flashTimer = 5;
  game.player.totalDamageDealt += dmg;
  spark(b.x,b.y,b.color,5,2);
  floatText(b.x,b.y-b.size,dmg,b.color);

  // Phase 2
  if(!b.phaseChanged && b.hp <= b.phase2Hp) {
    b.phase = 2;
    b.phaseChanged = true;
    b.spd *= 1.3;
    spark(b.x,b.y,b.color,40,5);
    setStatus(`[ ${b.name} — PHASE 2 ACTIVATED ]`, 150);
  }

  if(b.hp <= 0) {
    b.alive = false;
    game.bossActive = false;
    game.kills++;
    game.score += b.score;
    game.player.xp += 30;
    spark(b.x,b.y,b.color,50,6,true);
    for(let i=0;i<6;i++) game.pickups.push(mkPickup(b.x+~~(Math.random()*80-40), b.y+~~(Math.random()*80-40)));
    document.getElementById('boss-hud').classList.add('hidden');
    setStatus(`[ ${b.name} ELIMINATED — WELL DONE, FRAGMENT ]`, 200);
    endWave();
  }
}

// ── ENEMY BULLETS ─────────────────────────
function updateEBullets() {
  game.eBullets = game.eBullets.filter(b => {
    b.x+=b.vx; b.y+=b.vy; b.life--;
    if(b.life<=0 || tAt(b.x,b.y)===1) return false;
    const p=game.player;
    if(p.invFrames>0) return true;
    if(Math.hypot(b.x-p.x, b.y-p.y) < 11+b.r) {
      hurtPlayer(b.dmg);
      return false;
    }
    return true;
  });
}

// ── ENEMIES UPDATE ────────────────────────
function updateEnemies() {
  const p = game.player;
  game.enemies = game.enemies.filter(e => e.alive !== false);
  game.comboTimer > 0 ? game.comboTimer-- : (game.combo = 0);

  game.enemies.forEach(e => {
    e.wobble += .05;
    if(e.flashTimer>0) e.flashTimer--;
    const dx=p.x-e.x, dy=p.y-e.y, dist=Math.hypot(dx,dy);
    e.angle = Math.atan2(dy,dx);

    // Move toward player
    const spd = e.spd * (e.ghost ? 1.2 : 1);
    moveE(e,(dx/dist)*spd,(dy/dist)*spd, e.size*.8, e.size*.8);

    // Melee
    if(dist < e.size+11 && p.invFrames===0) hurtPlayer(e.dmg);

    // Ranged
    if(e.fire>0) {
      if(e.fireCd>0) e.fireCd--;
      else if(dist < 320) {
        e.fireCd = e.fire;
        const a = Math.atan2(p.y-e.y, p.x-e.x);
        const j = (Math.random()-.5)*.18;
        game.eBullets.push({x:e.x,y:e.y,vx:Math.cos(a+j)*3.8,vy:Math.sin(a+j)*3.8,
          dmg:e.dmg,r:5,life:95,color:e.color});
        // Sniper shoots 2 bullets
        if(e.id==='SNIPER') {
          game.eBullets.push({x:e.x,y:e.y,vx:Math.cos(a)*4.5,vy:Math.sin(a)*4.5,
            dmg:e.dmg,r:5,life:95,color:e.color+'cc'});
        }
      }
    }
  });

  // Wave clear
  if(game.enemies.length===0 && !game.betweenWaves && !game.bossActive) endWave();
}

// ── BOSS UPDATE ───────────────────────────
function updateBoss() {
  const b = game.boss, p = game.player;
  b.wobble += .04;
  if(b.flashTimer>0) b.flashTimer--;

  const dx=p.x-b.x, dy=p.y-b.y, dist=Math.hypot(dx,dy);
  b.angle = Math.atan2(dy,dx);

  b.attackTimer++;
  const atkInterval = b.phase===2 ? 80 : 120;

  if(b.attackTimer >= atkInterval) {
    b.attackTimer=0;
    const atk = b.attacks[~~(Math.random()*b.attacks.length)];
    doBossAttack(b, atk, p);
  }

  // Move
  if(b.attackState!=='charge') {
    const spd = b.spd;
    const targetDist = 180;
    if(dist > targetDist) moveE(b,(dx/dist)*spd,(dy/dist)*spd,b.size,b.size);
    else if(dist < targetDist-50) moveE(b,-(dx/dist)*spd*.5,-(dy/dist)*spd*.5,b.size,b.size);
  } else {
    moveE(b,b.chargeDx*5,b.chargeDy*5,b.size,b.size);
    if(Math.hypot(p.x-b.x,p.y-b.y)<b.size+12 && p.invFrames===0) hurtPlayer(b.dmg*2);
    if(tAt(b.x+b.chargeDx*b.size,b.y+b.chargeDy*b.size)===1 || b.attackTimer>=1) {
      b.attackState='idle';
      spark(b.x,b.y,b.color,15,4);
    }
  }

  // Orbit bullets phase 2
  if(b.phase===2 && game.t%50===0) {
    for(let i=0;i<4;i++) {
      const a=i*(Math.PI/2)+game.t*.03;
      game.eBullets.push({x:b.x+Math.cos(a)*b.size*2,y:b.y+Math.sin(a)*b.size*2,
        vx:Math.cos(a+Math.PI/2)*2.5,vy:Math.sin(a+Math.PI/2)*2.5,
        dmg:b.dmg*.6,r:5,life:80,color:b.color});
    }
  }

  // Melee
  if(dist < b.size+12 && p.invFrames===0) hurtPlayer(b.dmg);

  // Update boss HP bar
  document.getElementById('boss-fill').style.width=(b.hp/b.maxHp*100)+'%';
}

function doBossAttack(b, atk, p) {
  const dx=p.x-b.x, dy=p.y-b.y;
  const baseA = Math.atan2(dy,dx);

  switch(atk) {
    case 'spin':
      for(let i=0;i<12;i++) {
        const a=i*(Math.PI*2/12)+b.wobble;
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*3.5,vy:Math.sin(a)*3.5,
          dmg:b.dmg*.7,r:5,life:100,color:b.color});
      }
      break;
    case 'charge':
      b.attackState='charge';
      b.chargeDx=Math.cos(baseA); b.chargeDy=Math.sin(baseA);
      b.attackTimer=-1; // stays charging for a moment
      break;
    case 'spread':
      for(let i=-3;i<=3;i++) {
        const a=baseA+i*.18;
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,
          dmg:b.dmg*.8,r:5,life:90,color:b.color});
      }
      break;
    case 'laser':
      for(let i=0;i<20;i++) {
        setTimeout(()=>{
          if(!game.boss?.alive) return;
          const a2=Math.atan2(p.y-b.y,p.x-b.x)+(Math.random()-.5)*.1;
          game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*6,vy:Math.sin(a2)*6,
            dmg:b.dmg*.5,r:4,life:80,color:b.color});
        },i*40);
      }
      break;
    case 'summon':
      for(let i=0;i<3;i++) game.enemies.push(mkEnemy(~~(Math.random()*4), game.wave));
      setStatus(`[ ${b.name}: SUMMONING REINFORCEMENTS ]`, 90);
      break;
    case 'nova':
      for(let i=0;i<24;i++) {
        const a=i*(Math.PI*2/24);
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,
          dmg:b.dmg*.6,r:5,life:110,color:b.color});
      }
      break;
    case 'teleport':
      const nr=game.rooms[~~(Math.random()*game.rooms.length)];
      spark(b.x,b.y,b.color,20,3);
      b.x=nr.cx*TILE; b.y=nr.cy*TILE;
      spark(b.x,b.y,b.color,20,3);
      break;
    case 'burst':
      for(let r=0;r<3;r++) {
        setTimeout(()=>{
          if(!game.boss?.alive) return;
          const a2=Math.atan2(p.y-b.y,p.x-b.x);
          for(let i=-2;i<=2;i++)
            game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a2+i*.2)*4.5,vy:Math.sin(a2+i*.2)*4.5,
              dmg:b.dmg*.5,r:5,life:80,color:b.color});
        },r*200);
      }
      break;
    case 'wall':
      for(let i=-6;i<=6;i++) {
        const a2=baseA+Math.PI/2;
        const ox=Math.cos(a2)*i*20, oy=Math.sin(a2)*i*20;
        game.eBullets.push({x:b.x+ox,y:b.y+oy,vx:Math.cos(baseA)*3,vy:Math.sin(baseA)*3,
          dmg:b.dmg*.7,r:5,life:90,color:b.color});
      }
      break;
    case 'orbit':
      // Spiral outward
      for(let i=0;i<36;i++) {
        setTimeout(()=>{
          if(!game.boss?.alive) return;
          const a2=i*(Math.PI*2/36)+game.t*.1;
          const spd2=1.5+i*.08;
          game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*spd2,vy:Math.sin(a2)*spd2,
            dmg:b.dmg*.4,r:5,life:150,color:b.color});
        },i*30);
      }
      break;
    case 'beam':
      for(let i=0;i<30;i++) {
        setTimeout(()=>{
          if(!game.boss?.alive) return;
          const a2=Math.atan2(p.y-b.y,p.x-b.x);
          game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*8,vy:Math.sin(a2)*8,
            dmg:b.dmg,r:7,life:60,color:b.color});
        },i*60);
      }
      break;
    case 'explode':
      for(let i=0;i<48;i++) {
        const a2=i*(Math.PI*2/48);
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*2.5,vy:Math.sin(a2)*2.5,
          dmg:b.dmg*.5,r:5,life:140,color:b.color});
      }
      spark(b.x,b.y,b.color,40,6);
      break;
  }
}

// ── PICKUPS UPDATE ────────────────────────
function updatePickups() {
  const p = game.player;
  const colors={hp:'#ff44aa',xp:'#44ffaa',shield:'#44aaff',weapon_token:'#ffee00'};
  game.pickups = game.pickups.filter(pk => {
    pk.life--; pk.pulse+=.08;
    if(pk.life<=0) return false;
    if(Math.hypot(p.x-pk.x, p.y-pk.y) < 20) {
      if(pk.type==='hp')      { p.hp=Math.min(p.maxHp,p.hp+30); floatText(pk.x,pk.y,'HP +30','#ff44aa'); }
      if(pk.type==='xp')      { p.xp+=8; floatText(pk.x,pk.y,'XP +8','#44ffaa'); }
      if(pk.type==='shield')  { p.maxShield=Math.max(p.maxShield,30); p.shield=Math.min(p.maxShield,p.shield+30); floatText(pk.x,pk.y,'SHIELD','#44aaff'); }
      if(pk.type==='weapon_token') { showWeaponTokenUpgrade(); return false; }
      spark(pk.x,pk.y,colors[pk.type]||'#ffffff',8,2);
      return false;
    }
    return true;
  });
}

function showWeaponTokenUpgrade() {
  // Give player a weapon choice
  const keys = Object.keys(WEAPON_TYPES).filter(k=>k!==game.currentWeapon);
  const picks = keys.sort(()=>Math.random()-.5).slice(0,2);
  const fakeUpgrades = picks.map(k=>({
    tier:'E', icon:WEAPON_TYPES[k].icon, name:WEAPON_TYPES[k].name,
    color:WEAPON_TYPES[k].color, desc:WEAPON_TYPES[k].desc,
    fn:(p,g)=>{ g.setWeapon(k); }
  }));
  showUpgradeScreen([...fakeUpgrades, ALL_UPGRADES[~~(Math.random()*6)]]);
}

// ── PARTICLES UPDATE ──────────────────────
function updateParticles() {
  game.particles = game.particles.filter(pt => {
    pt.x+=pt.vx; pt.y+=pt.vy;
    pt.vx*=.88; pt.vy*=.88;
    if(pt.gravity) pt.vy+=.08;
    pt.life--;
    return pt.life>0;
  });
}

function updateFloatingTexts() {
  game.floatingTexts = game.floatingTexts.filter(ft => {
    ft.y+=ft.vy; ft.life--;
    return ft.life>0;
  });
}

function updateDashBtn() {
  const p = game.player;
  const btn = document.getElementById('dash-btn');
  const cdEl = document.getElementById('dash-cd');
  if(p.dashCd>0) {
    btn.classList.add('cooldown');
    cdEl.style.width=((1-p.dashCd/p.dashMaxCd)*100)+'%';
  } else {
    btn.classList.remove('cooldown');
    cdEl.style.width='100%';
  }
}

// ── HURT PLAYER ───────────────────────────
function hurtPlayer(dmg) {
  const p = game.player;
  if(p.invFrames>0) return;

  // Shield absorbs first
  if(p.shield > 0) {
    const absorbed = Math.min(p.shield, dmg);
    p.shield -= absorbed;
    dmg -= absorbed;
    spark(p.x,p.y,'#0088ff',6,2);
    p.shieldRegenCd = 0;
  }

  if(dmg <= 0) return;
  p.hp -= dmg;
  p.invFrames = 38;
  p.totalDamageTaken += dmg;
  spark(p.x, p.y, '#ff003c', 10, 3);
  floatText(p.x, p.y-20, '-'+dmg, '#ff003c');
  canvas.classList.add('flash');
  setTimeout(()=>canvas.classList.remove('flash'),120);

  if(p.hp <= 0) { p.hp=0; endGame(); }
}

// ── WAVE END ──────────────────────────────
function endWave() {
  game.wave++;
  game.betweenWaves = true;
  game.waveTimer = 0;
  setStatus(`[ WAVE ${game.wave-1} CLEARED ]`, 120);
}

// ── LEVEL UP ──────────────────────────────
function checkLevelUp() {
  const p = game.player;
  if(p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.xpNext = ~~(p.xpNext*1.45);
    p.level++;
    document.getElementById('upg-level').textContent = `LEVEL UP → LVL ${p.level}`;
    showUpgradeScreen();
  }
}

function showUpgradeScreen(overrides) {
  game.paused = true;
  const upgrades = overrides || pickUpgrades(3);
  const container = document.getElementById('upgrade-cards');
  container.innerHTML = '';
  upgrades.forEach(u => {
    const c = document.createElement('div');
    c.className = `upg-card${u.tier==='R'?' rare':u.tier==='E'?' epic':''}`;
    c.innerHTML = `
      <div class="icon">${u.icon}</div>
      <div class="name" style="color:${u.color}">${u.name}</div>
      <div class="desc">${u.desc}</div>
      <div class="tier" style="color:${u.color}88">${{C:'COMMON',R:'RARE',E:'EPIC'}[u.tier]}</div>`;
    c.addEventListener('click', () => {
      u.fn(game.player, game);
      document.getElementById('upgrade-screen').classList.remove('active');
      game.paused = false;
      addBuff(u.name);
      setStatus(`[ ${u.name} INSTALLED ]`, 90);
    });
    container.appendChild(c);
  });
  showScreen('upgrade-screen');
}

function pickUpgrades(n) {
  const pool = [...ALL_UPGRADES];
  // Weight by tier
  const weighted = [];
  pool.forEach(u => {
    const w = u.tier==='C'?5 : u.tier==='R'?2 : 1;
    for(let i=0;i<w;i++) weighted.push(u);
  });
  const result = [];
  const used = new Set();
  while(result.length<n && used.size < pool.length) {
    const pick = weighted[~~(Math.random()*weighted.length)];
    if(!used.has(pick.name)) { used.add(pick.name); result.push(pick); }
  }
  return result;
}

function addBuff(name) {
  const row = document.getElementById('active-buffs');
  if(row.children.length >= 8) row.removeChild(row.firstChild);
  const chip = document.createElement('div');
  chip.className = 'buff-chip';
  chip.textContent = name;
  row.appendChild(chip);
}

// ── DRAW ──────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-~~game.camera.x, -~~game.camera.y);
  drawMap();
  drawPickups();
  drawParticles();
  drawEBullets();
  drawBullets();
  drawEnemies();
  if(game.bossActive && game.boss) drawBoss();
  drawFloatingTexts();
  drawPlayer();
  ctx.restore();
  drawMinimap();
}

// ── DRAW MAP ──────────────────────────────
function drawMap() {
  const cam = game.camera;
  const sx=Math.max(0,~~(cam.x/TILE)), sy=Math.max(0,~~(cam.y/TILE));
  const ex=Math.min(MAP_W,sx+~~(canvas.width/TILE)+2);
  const ey=Math.min(MAP_H,sy+~~(canvas.height/TILE)+2);

  for(let ty=sy;ty<ey;ty++) {
    for(let tx=sx;tx<ex;tx++) {
      const wx=tx*TILE, wy=ty*TILE;
      if(game.map[ty][tx]===1) {
        ctx.fillStyle='#05001a'; ctx.fillRect(wx,wy,TILE,TILE);
        ctx.fillStyle='#070025'; ctx.fillRect(wx+1,wy+1,TILE-2,TILE-2);
        // Top/left edge highlight
        ctx.fillStyle='#0d003a';
        ctx.fillRect(wx+1,wy+1,TILE-2,1);
        ctx.fillRect(wx+1,wy+1,1,TILE-2);
      } else {
        ctx.fillStyle='#020012'; ctx.fillRect(wx,wy,TILE,TILE);
        ctx.strokeStyle='#04001a'; ctx.lineWidth=.5;
        ctx.strokeRect(wx+.5,wy+.5,TILE-1,TILE-1);
      }
    }
  }
}

// ── DRAW PLAYER ───────────────────────────
function drawPlayer() {
  const p = game.player;
  const t = game.t;

  // Trail
  p.trail.forEach((pt,i) => {
    const a = (1-i/p.trail.length)*.35;
    const r = 7*(1-i/p.trail.length);
    const g2 = ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,r);
    g2.addColorStop(0,`rgba(0,255,247,${a})`);
    g2.addColorStop(1,'transparent');
    ctx.fillStyle=g2; ctx.beginPath();
    ctx.arc(pt.x,pt.y,r,0,Math.PI*2); ctx.fill();
  });

  // Dash streak
  if(p.dashForce>0) {
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x-p.dashDx*40, p.y-p.dashDy*40);
    ctx.strokeStyle='#00fff740'; ctx.lineWidth=8; ctx.stroke();
  }

  if(p.invFrames>0 && ~~(p.invFrames/4)%2===0) return;

  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);

  // Glow
  const grd = ctx.createRadialGradient(0,0,0,0,0,20);
  grd.addColorStop(0,'#00fff722'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill();

  // Engine glow pulse
  const pulse=.5+.5*Math.sin(t*.2);
  ctx.shadowColor='#00fff7'; ctx.shadowBlur=10+pulse*8;

  // Body
  ctx.fillStyle='#00fff7';
  ctx.beginPath();
  ctx.moveTo(12,0); ctx.lineTo(-8,8); ctx.lineTo(-5,0); ctx.lineTo(-8,-8);
  ctx.closePath(); ctx.fill();

  // Wing accents
  ctx.fillStyle='#00aaaa';
  ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(-8,5); ctx.lineTo(-6,0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(-8,-5); ctx.lineTo(-6,0); ctx.closePath(); ctx.fill();

  // Core
  ctx.fillStyle='#ffffff'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.arc(-1,0,3,0,Math.PI*2); ctx.fill();

  ctx.restore();

  // Shield ring
  if(p.shield>0) {
    const sr=20+2*Math.sin(t*.1);
    ctx.beginPath(); ctx.arc(p.x,p.y,sr,0,Math.PI*2);
    ctx.strokeStyle=`rgba(0,136,255,${.3+.2*Math.sin(t*.15)})`;
    ctx.lineWidth=2+p.shield/p.maxShield;
    ctx.stroke();
  }
}

// ── DRAW ENEMIES ──────────────────────────
function drawEnemies() {
  game.enemies.forEach(e => {
    ctx.save(); ctx.translate(e.x,e.y);
    const pulse=.5+.5*Math.sin(game.t*.15+e.wobble);

    // Glow
    const grd=ctx.createRadialGradient(0,0,0,0,0,e.size*2.8);
    grd.addColorStop(0,e.color+'30'); grd.addColorStop(1,'transparent');
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,e.size*2.8,0,Math.PI*2); ctx.fill();

    ctx.shadowColor=e.color; ctx.shadowBlur=e.flashTimer>0?25:8+pulse*5;
    ctx.fillStyle=e.flashTimer>0?'#ffffff':e.color;

    // Ghost: semi-transparent
    if(e.ghost) ctx.globalAlpha=.6+.2*Math.sin(game.t*.1+e.wobble);

    const s=e.size;
    drawEnemyShape(e, s);
    ctx.globalAlpha=1;
    ctx.restore();

    // HP bar
    if(e.hp<e.maxHp) {
      const bw=e.size*3, bh=3, bx=e.x-bw/2, by=e.y-e.size-10;
      ctx.fillStyle='#22001188'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle=e.color; ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),bh);
    }
  });
}

function drawEnemyShape(e, s) {
  switch(e.shape) {
    case 'tri':
      ctx.rotate(e.angle+Math.PI/2);
      ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s*.8,s*.7); ctx.lineTo(-s*.8,s*.7);
      ctx.closePath(); ctx.fill(); break;
    case 'dia':
      ctx.rotate(e.wobble*.3);
      ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0);
      ctx.closePath(); ctx.fill(); break;
    case 'hex':
      ctx.beginPath();
      for(let i=0;i<6;i++){const a=i*Math.PI/3;
        i===0?ctx.moveTo(Math.cos(a)*s,Math.sin(a)*s):ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s);}
      ctx.closePath(); ctx.fill(); break;
    case 'arrow':
      ctx.rotate(e.angle);
      ctx.beginPath(); ctx.moveTo(s*1.6,0); ctx.lineTo(-s,s*.65); ctx.lineTo(-s*.4,0); ctx.lineTo(-s,-s*.65);
      ctx.closePath(); ctx.fill(); break;
    case 'cross':
      ctx.rotate(e.wobble*.5);
      for(let i=0;i<4;i++){ctx.fillRect(-s*.28,-s*1.1,s*.56,s*2.2);ctx.rotate(Math.PI/2);}
      break;
    case 'sq':
      ctx.rotate(e.wobble*.2);
      ctx.fillRect(-s,-s,s*2,s*2); break;
  }
}

// ── DRAW BOSS ─────────────────────────────
function drawBoss() {
  const b = game.boss;
  ctx.save(); ctx.translate(b.x,b.y);
  const pulse=.5+.5*Math.sin(game.t*.08);
  const s=b.size;

  // Outer aura
  const grd=ctx.createRadialGradient(0,0,0,0,0,s*4);
  grd.addColorStop(0,b.color+(b.phase===2?'40':'20'));
  grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,s*4,0,Math.PI*2); ctx.fill();

  // Rotating ring
  ctx.save(); ctx.rotate(game.t*.03);
  ctx.strokeStyle=b.color+(b.phase===2?'99':'55');
  ctx.lineWidth=2; ctx.setLineDash([8,8]);
  ctx.beginPath(); ctx.arc(0,0,s*1.8,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.shadowColor=b.color; ctx.shadowBlur=b.flashTimer>0?40:(15+pulse*15);
  ctx.fillStyle=b.flashTimer>0?'#ffffff':b.color;

  // Boss body
  ctx.rotate(b.wobble*.05);
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=i*(Math.PI/4);
    const r=s*(i%2===0?1:0.7);
    i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  ctx.closePath(); ctx.fill();

  // Core
  ctx.fillStyle=b.phase===2?'#ffffff':'#ffffff88';
  ctx.shadowBlur=20;
  ctx.beginPath(); ctx.arc(0,0,s*.35,0,Math.PI*2); ctx.fill();

  // Phase 2 extra ring
  if(b.phase===2) {
    ctx.strokeStyle=b.color+'cc';
    ctx.lineWidth=3; ctx.shadowBlur=15;
    ctx.save(); ctx.rotate(-game.t*.05);
    ctx.beginPath(); ctx.arc(0,0,s*1.4,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ── DRAW BULLETS ──────────────────────────
function drawBullets() {
  game.bullets.forEach(b => {
    b.trail.forEach((pt,i) => {
      ctx.beginPath(); ctx.arc(pt.x,pt.y,b.r*.5*(1-i/b.trail.length),0,Math.PI*2);
      const alpha=.35*(1-i/b.trail.length);
      ctx.fillStyle=b.color+(~~(alpha*255).toString(16).padStart(2,'0'));
      ctx.fill();
    });
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fillStyle=b.color;
    ctx.shadowColor=b.color; ctx.shadowBlur=12;
    ctx.fill();
    ctx.shadowBlur=0;
  });
}

function drawEBullets() {
  game.eBullets.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fillStyle=b.color+'dd';
    ctx.shadowColor=b.color; ctx.shadowBlur=8;
    ctx.fill();
    ctx.shadowBlur=0;
  });
}

// ── DRAW PARTICLES ────────────────────────
function drawParticles() {
  game.particles.forEach(pt => {
    const a=pt.life/pt.maxLife;
    const hex=(~~(a*255)).toString(16).padStart(2,'0');
    ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r*a,0,Math.PI*2);
    ctx.fillStyle=pt.color+hex;
    ctx.fill();
  });
}

function drawPickups() {
  const colors={hp:'#ff44aa',xp:'#44ffaa',shield:'#44aaff',weapon_token:'#ffee00'};
  const icons ={hp:'♥',xp:'◈',shield:'⬡',weapon_token:'★'};
  game.pickups.forEach(pk => {
    const sc=1+.18*Math.sin(pk.pulse*2);
    const c=colors[pk.type]||'#ffffff';
    ctx.save(); ctx.translate(pk.x,pk.y); ctx.scale(sc,sc);
    ctx.fillStyle=c; ctx.shadowColor=c; ctx.shadowBlur=18;
    ctx.font='bold 14px Share Tech Mono';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(icons[pk.type]||'?',0,0);
    ctx.restore();

    // Pulse ring
    const pr=12+6*Math.sin(pk.pulse);
    ctx.beginPath(); ctx.arc(pk.x,pk.y,pr,0,Math.PI*2);
    ctx.strokeStyle=c+'44'; ctx.lineWidth=1; ctx.stroke();
  });
}

function drawFloatingTexts() {
  game.floatingTexts.forEach(ft => {
    const a=ft.life/ft.maxLife;
    ctx.globalAlpha=a;
    ctx.fillStyle=ft.color;
    ctx.shadowColor=ft.color; ctx.shadowBlur=6;
    ctx.font=`bold 11px 'Orbitron',monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(ft.text,ft.x,ft.y);
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  });
}

// ── MINIMAP ───────────────────────────────
function drawMinimap() {
  const mw=90, mh=90;
  const scX=mw/MAP_W, scY=mh/MAP_H;
  mm.clearRect(0,0,mw,mh);
  mm.fillStyle='#00000c'; mm.fillRect(0,0,mw,mh);

  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++)
    if(game.map[y][x]===0){ mm.fillStyle='#0d0030'; mm.fillRect(x*scX,y*scY,scX,scY); }

  game.enemies.forEach(e=>{
    mm.fillStyle=e.color+'88';
    mm.fillRect(e.x/TILE*scX-1,e.y/TILE*scY-1,2,2);
  });

  if(game.bossActive && game.boss?.alive) {
    const b=game.boss;
    mm.fillStyle=b.color;
    mm.beginPath(); mm.arc(b.x/TILE*scX,b.y/TILE*scY,4,0,Math.PI*2); mm.fill();
  }

  const p=game.player;
  mm.fillStyle='#00fff7';
  mm.beginPath(); mm.arc(p.x/TILE*scX,p.y/TILE*scY,3,0,Math.PI*2); mm.fill();
  // Dot glow
  mm.strokeStyle='#00fff744'; mm.lineWidth=1;
  mm.beginPath(); mm.arc(p.x/TILE*scX,p.y/TILE*scY,5,0,Math.PI*2); mm.stroke();
}

// ── HUD UPDATE ────────────────────────────
function updateHUD() {
  const p=game.player;
  document.getElementById('hp-fill').style.width=(Math.max(0,p.hp)/p.maxHp*100)+'%';
  document.getElementById('hp-val').textContent=~~p.hp;
  document.getElementById('sh-fill').style.width=(p.maxShield>0?(p.shield/p.maxShield*100):0)+'%';
  document.getElementById('sh-val').textContent=~~p.shield;
  document.getElementById('xp-fill').style.width=(p.xp/p.xpNext*100)+'%';
  document.getElementById('lvl-val').textContent='LV'+p.level;
  document.getElementById('wave-val').textContent=String(game.wave).padStart(2,'0');
  document.getElementById('kill-val').textContent=game.kills;
  document.getElementById('score-val').textContent=String(game.score).padStart(6,'0');
  checkLevelUp();
}

// ── GAME OVER ─────────────────────────────
function endGame() {
  game.running = false;
  // High score
  const newBest = game.score>highScore.score||game.wave>highScore.wave||game.kills>highScore.kills;
  if(game.score>highScore.score) highScore.score=game.score;
  if(game.wave>highScore.wave)   highScore.wave=game.wave;
  if(game.kills>highScore.kills) highScore.kills=game.kills;
  saveHS(); updateHSDisplay();

  document.getElementById('go-stats').innerHTML=`
    <div class="label">SCORE</div>
    <div class="value ${game.score>=highScore.score?'new-best':''}">${String(game.score).padStart(6,'0')}</div>
    <div class="label">WAVE</div>
    <div class="value">${game.wave}</div>
    <div class="label">KILLS</div>
    <div class="value">${game.kills}</div>
    <div class="label">LEVEL</div>
    <div class="value">${game.player.level}</div>
    <div class="label">DAMAGE DEALT</div>
    <div class="value">${game.player.totalDamageDealt}</div>
    <div class="label">WEAPON</div>
    <div class="value">${game.currentWeapon}</div>
  `;
  showScreen('gameover-screen');
}

// ── GAME LOOP ─────────────────────────────
function loop() {
  update();
  if(game.running || game.betweenWaves) draw();
  requestAnimationFrame(loop);
}

// ── START ─────────────────────────────────
function startGame() {
  resizeCanvas();
  initInput();
  initGame();
  const {map,rooms} = generateMap();
  game.map=map; game.rooms=rooms;
  const sr=rooms[0];
  game.player = mkPlayer(sr.cx*TILE+TILE/2, sr.cy*TILE+TILE/2);
  game.camera.x = game.player.x-canvas.width/2;
  game.camera.y = game.player.y-canvas.height/2;
  game.running = true;
  game.setWeapon = setWeapon;

  // Set default weapon display
  const w = WEAPON_TYPES['PULSE'];
  document.getElementById('wep-icon').textContent=w.icon;
  document.getElementById('wep-name').textContent=w.name;
  document.getElementById('active-buffs').innerHTML='';

  hideScreen('title-screen');
  hideScreen('gameover-screen');
  hideScreen('upgrade-screen');
  hideScreen('pause-screen');
  document.getElementById('game-wrapper').style.display='flex';
  document.getElementById('boss-hud').classList.add('hidden');

  // Resize AFTER wrapper is visible so dimensions are correct
  requestAnimationFrame(() => {
    resizeCanvas();
    game.camera.x = game.player.x - canvas.width/2;
    game.camera.y = game.player.y - canvas.height/2;
    startWave();
  });
}

// ── SCREEN HELPERS ────────────────────────
function showScreen(id) {
  document.getElementById(id).classList.add('active');
  document.getElementById(id).style.display='flex';
}
function hideScreen(id) {
  document.getElementById(id).classList.remove('active');
  document.getElementById(id).style.display='none';
}

// ── INPUT ─────────────────────────────────
document.addEventListener('keydown', e => {
  if(!input) return;
  input.keys[e.key]=true;
  if(e.key==='Escape'||e.key==='p'||e.key==='P') togglePause();
  if(e.key==='Shift') input.dash=true;
});
document.addEventListener('keyup', e => { if(input) input.keys[e.key]=false; });

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('menu-btn').addEventListener('click', () => {
  hideScreen('gameover-screen');
  document.getElementById('game-wrapper').style.display='none';
  showScreen('title-screen');
});
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('quit-btn').addEventListener('click', () => {
  hideScreen('pause-screen');
  document.getElementById('game-wrapper').style.display='none';
  game.running=false;
  showScreen('title-screen');
});

// Dash button
document.getElementById('dash-btn').addEventListener('touchstart', e=>{
  e.preventDefault();
  if(input) input.dash=true;
},{passive:false});

function togglePause() {
  if(!game.running) return;
  game.paused = !game.paused;
  game.paused ? showScreen('pause-screen') : hideScreen('pause-screen');
}

// ── PC MOUSE AIM ──────────────────────────
canvas.addEventListener('mousemove', e=>{
  if(!game?.player||!game.running) return;
  const r=canvas.getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top;
  const px=game.player.x-game.camera.x, py=game.player.y-game.camera.y;
  game.player.angle=Math.atan2(my-py,mx-px);
});
canvas.addEventListener('mousedown', ()=>{ if(input) input.fire.active=true; });
canvas.addEventListener('mouseup',   ()=>{ if(input) input.fire.active=false; });

// ══════════════════════════════════════════
//  TWIN-STICK TOUCH JOYSTICKS
// ══════════════════════════════════════════
function setupJoystick(zoneId, knobId, onMove) {
  const zone=document.getElementById(zoneId);
  const knob=document.getElementById(knobId);
  const R=58;
  let tid=null;

  function getCenter(){
    const r=zone.getBoundingClientRect();
    return{x:r.left+r.width/2, y:r.top+r.height/2};
  }
  function apply(tx,ty){
    const c=getCenter();
    let dx=tx-c.x, dy=ty-c.y;
    const d=Math.hypot(dx,dy);
    if(d>R){dx=dx/d*R;dy=dy/d*R;}
    knob.style.transform=`translate(${dx}px,${dy}px)`;
    onMove(dx/R, dy/R, true);
  }
  function reset(){
    tid=null;
    knob.style.transform='translate(0,0)';
    onMove(0,0,false);
    zone.classList.remove('active');
  }

  zone.addEventListener('touchstart',e=>{
    e.preventDefault();
    if(tid!==null) return;
    tid=e.changedTouches[0].identifier;
    zone.classList.add('active');
    apply(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
  },{passive:false});
  document.addEventListener('touchmove',e=>{
    e.preventDefault();
    for(const t of e.changedTouches)
      if(t.identifier===tid){apply(t.clientX,t.clientY);break;}
  },{passive:false});
  document.addEventListener('touchend',e=>{
    for(const t of e.changedTouches) if(t.identifier===tid){reset();break;}
  });
  document.addEventListener('touchcancel',e=>{
    for(const t of e.changedTouches) if(t.identifier===tid){reset();break;}
  });
}

setupJoystick('move-zone','move-knob',(x,y)=>{if(input){input.move.x=x;input.move.y=y;}});
setupJoystick('fire-zone','fire-knob',(x,y,a)=>{if(input){input.fire.x=x;input.fire.y=y;input.fire.active=a;}});

// ── BOOT ──────────────────────────────────
initInput();
initGame();
game.map=Array.from({length:MAP_H},()=>Array(MAP_W).fill(0));
game.setWeapon=setWeapon;
loop();
