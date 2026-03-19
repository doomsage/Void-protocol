'use strict';
/* ══════════════════════════════════════════
   VOID PROTOCOL v2 — Full Engine
   A* Pathfinding · Claude API Elites
   Mixed Map · Group Tactics · Screen Shake
══════════════════════════════════════════ */

// ── CANVAS ───────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
const mmCv   = document.getElementById('minimap');
const mm     = mmCv.getContext('2d');

const TILE = 28, MAP_W = 80, MAP_H = 60;

function resizeCanvas() {
  const a = document.getElementById('canvas-area');
  canvas.width  = Math.max(a.offsetWidth  || window.innerWidth,  50);
  canvas.height = Math.max(a.offsetHeight || (window.innerHeight - 44 - 20 - 155), 50);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));

// ── SCREEN SHAKE ─────────────────────────
let shakeAmt = 0, shakeX = 0, shakeY = 0;
function triggerShake(amt = 8) { shakeAmt = Math.max(shakeAmt, amt); }
function updateShake() {
  if (shakeAmt > 0) {
    shakeX = (Math.random() - .5) * shakeAmt;
    shakeY = (Math.random() - .5) * shakeAmt;
    shakeAmt *= .75;
    if (shakeAmt < .5) { shakeAmt = 0; shakeX = 0; shakeY = 0; }
  }
}

// ═══════════════════════════════════════
//  A* PATHFINDING
// ═══════════════════════════════════════
const PATH_GRID_SCALE = 2; // every 2 tiles = 1 pathfinding node
const PGW = Math.ceil(MAP_W / PATH_GRID_SCALE);
const PGH = Math.ceil(MAP_H / PATH_GRID_SCALE);

function buildWalkable(map) {
  const w = Array.from({ length: PGH }, () => Array(PGW).fill(false));
  for (let py = 0; py < PGH; py++)
    for (let px = 0; px < PGW; px++) {
      const tx = px * PATH_GRID_SCALE, ty = py * PATH_GRID_SCALE;
      // node walkable if majority of tiles are floor
      let floors = 0;
      for (let dy = 0; dy < PATH_GRID_SCALE; dy++)
        for (let dx = 0; dx < PATH_GRID_SCALE; dx++) {
          const mx = tx+dx, my = ty+dy;
          if (mx<MAP_W && my<MAP_H && map[my][mx]===0) floors++;
        }
      w[py][px] = floors >= (PATH_GRID_SCALE * PATH_GRID_SCALE) / 2;
    }
  return w;
}

function astar(walkable, sx, sy, ex, ey) {
  if (!walkable[sy]?.[sx] || !walkable[ey]?.[ex]) return null;
  const h = (ax, ay) => Math.abs(ax-ex)+Math.abs(ay-ey);
  const key = (x,y) => y*PGW+x;
  const open = new Map();
  const closed = new Set();
  const gScore = new Map();
  const fScore = new Map();
  const parent = new Map();
  const start = key(sx,sy);
  gScore.set(start,0); fScore.set(start,h(sx,sy));
  open.set(start,{x:sx,y:sy});

  let iter = 0;
  while (open.size && iter++ < 500) {
    // Get lowest fScore node
    let bestK = null, bestF = Infinity;
    for (const [k,_] of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) { bestF = f; bestK = k; }
    }
    if (bestK === null) break;
    const cur = open.get(bestK);
    if (cur.x===ex && cur.y===ey) {
      // Reconstruct
      const path = [];
      let k = key(ex,ey);
      while (parent.has(k)) {
        const n = parent.get(k);
        path.unshift(n);
        k = key(n.x,n.y);
      }
      path.push({x:ex,y:ey});
      return path;
    }
    open.delete(bestK); closed.add(bestK);
    const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},
                  {x:1,y:1},{x:-1,y:1},{x:1,y:-1},{x:-1,y:-1}];
    for (const d of dirs) {
      const nx=cur.x+d.x, ny=cur.y+d.y;
      if (nx<0||ny<0||nx>=PGW||ny>=PGH||!walkable[ny]?.[nx]) continue;
      const nk = key(nx,ny);
      if (closed.has(nk)) continue;
      const diag = d.x!==0&&d.y!==0;
      const tentG = (gScore.get(bestK)??0) + (diag?1.41:1);
      if (tentG < (gScore.get(nk)??Infinity)) {
        parent.set(nk,{x:cur.x,y:cur.y});
        gScore.set(nk,tentG);
        fScore.set(nk,tentG+h(nx,ny));
        open.set(nk,{x:nx,y:ny});
      }
    }
  }
  return null;
}

// Convert world pos to path grid
function worldToPG(wx,wy) {
  return { x: Math.floor(wx/TILE/PATH_GRID_SCALE), y: Math.floor(wy/TILE/PATH_GRID_SCALE) };
}
function pgToWorld(px,py) {
  return { x:(px*PATH_GRID_SCALE+PATH_GRID_SCALE/2)*TILE, y:(py*PATH_GRID_SCALE+PATH_GRID_SCALE/2)*TILE };
}

// ═══════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════
const WEAPONS = {
  PULSE:   {n:'PULSE',   ic:'●',col:'#00fff7',rof:18,spd:6.5,dmg:18,range:75,spread:0,   cnt:1,pier:false},
  BURST:   {n:'BURST',   ic:'⦿',col:'#00aaff',rof:28,spd:7.2,dmg:15,range:68,spread:.14,cnt:3,pier:false},
  SCATTER: {n:'SCATTER', ic:'❋',col:'#ff8800',rof:24,spd:5.5,dmg:11,range:55,spread:.3, cnt:5,pier:false},
  LASER:   {n:'LASER',   ic:'━',col:'#ff00cc',rof:38,spd:9.5,dmg:30,range:95,spread:0,   cnt:1,pier:true },
  NOVA:    {n:'NOVA',    ic:'✦',col:'#cc00ff',rof:55,spd:4,  dmg:38,range:50,spread:.55, cnt:8,pier:false},
  RAILGUN: {n:'RAILGUN', ic:'▬',col:'#ffee00',rof:50,spd:12, dmg:55,range:120,spread:0,  cnt:1,pier:true },
};

// Enemy behavior states
const ES = { IDLE:'idle', CHASE:'chase', FLANK:'flank', RETREAT:'retreat', PATROL:'patrol', AMBUSH:'ambush' };

const ENEMY_DEFS = [
  {id:0,name:'CHASER',   col:'#ff003c',sz:10,hp:35, spd:1.6,dmg:12,xp:3, sc:100,fire:0,  shape:'tri',  tier:'N'},
  {id:1,name:'SHOOTER',  col:'#ff8800',sz:9, hp:25, spd:1.0,dmg:9, xp:4, sc:150,fire:75, shape:'dia',  tier:'N'},
  {id:2,name:'TANK',     col:'#cc00ff',sz:16,hp:130,spd:0.8,dmg:18,xp:8, sc:300,fire:0,  shape:'hex',  tier:'N'},
  {id:3,name:'SPEEDER',  col:'#00ffcc',sz:7, hp:18, spd:3.2,dmg:7, xp:2, sc:80, fire:0,  shape:'arr',  tier:'N'},
  {id:4,name:'SNIPER',   col:'#ffee00',sz:9, hp:22, spd:0.6,dmg:28,xp:6, sc:200,fire:110,shape:'crs',  tier:'N'},
  {id:5,name:'SPLITTER', col:'#ff6600',sz:13,hp:55, spd:1.2,dmg:13,xp:7, sc:250,fire:0,  shape:'sq',   tier:'N',splits:true},
  {id:6,name:'GHOST',    col:'#aaaaff',sz:9, hp:22, spd:2.0,dmg:10,xp:5, sc:180,fire:55, shape:'dia',  tier:'N',ghost:true},
  {id:7,name:'BOMBER',   col:'#ff4400',sz:12,hp:45, spd:1.4,dmg:35,xp:9, sc:350,fire:0,  shape:'hex',  tier:'N',bomber:true},
  // ELITE variants
  {id:8, name:'ELITE CHASER',  col:'#ff6688',sz:14,hp:120,spd:2.2,dmg:20,xp:15,sc:500, fire:0,  shape:'tri',tier:'E',elite:true},
  {id:9, name:'ELITE SHOOTER', col:'#ffaa44',sz:12,hp:90, spd:1.5,dmg:16,xp:18,sc:600, fire:45, shape:'dia',tier:'E',elite:true},
  {id:10,name:'JUGGERNAUT',    col:'#ff00ff',sz:22,hp:300,spd:1.0,dmg:25,xp:25,sc:900, fire:0,  shape:'hex',tier:'E',elite:true,jugg:true},
  {id:11,name:'SHADE',         col:'#8888ff',sz:11,hp:60, spd:2.8,dmg:15,xp:20,sc:700, fire:40, shape:'arr',tier:'E',elite:true,ghost:true},
  {id:12,name:'WARLORD',       col:'#ff2200',sz:18,hp:200,spd:1.1,dmg:22,xp:30,sc:1000,fire:60, shape:'sq', tier:'E',elite:true,leads:true},
];

const BOSS_DEFS = [
  {name:'APEX PROCESS',  col:'#ff003c',sz:30,hp:700, spd:1.3,dmg:22,sc:2500,p2hp:350, atks:['spin','charge','spread','laser']},
  {name:'VOID SENTINEL', col:'#cc00ff',sz:34,hp:1000,spd:1.0,dmg:28,sc:4000,p2hp:500, atks:['nova','summon','teleport','beam']},
  {name:'DATA WRAITH',   col:'#00ffcc',sz:26,hp:850, spd:2.2,dmg:20,sc:3500,p2hp:425, atks:['burst','wall','orbit','charge']},
  {name:'NULL CORE',     col:'#ffee00',sz:38,hp:1400,spd:0.7,dmg:35,sc:6000,p2hp:700, atks:['explode','beam','spin','summon','nova']},
];

const UPGRADES = [
  {tier:'C',ic:'⚡',n:'OVERCLOCK',   col:'#00fff7',d:'Fire rate +30%',        fn:p=>{p.fireRate=Math.max(5,~~(p.fireRate*.70));}},
  {tier:'C',ic:'🔴',n:'VELOCITY+',   col:'#ff6644',d:'Move speed +20%',       fn:p=>{p.spd*=1.2;}},
  {tier:'C',ic:'🔋',n:'REGEN',        col:'#00ff88',d:'Restore 40 HP',         fn:p=>{p.hp=Math.min(p.maxHp,p.hp+40);}},
  {tier:'C',ic:'💛',n:'PAYLOAD+',    col:'#ffcc00',d:'Bullet damage +20%',     fn:p=>{p.bulletDmg=~~(p.bulletDmg*1.2);}},
  {tier:'C',ic:'🔵',n:'MAX HP+',     col:'#4488ff',d:'Max HP +40',             fn:p=>{p.maxHp+=40;p.hp=Math.min(p.maxHp,p.hp+20);}},
  {tier:'C',ic:'🟢',n:'RANGE+',      col:'#00ff88',d:'Bullet range +25%',      fn:p=>{p.bulletRange=~~(p.bulletRange*1.25);}},
  {tier:'R',ic:'🌀',n:'SPREAD',       col:'#ff00cc',d:'Fire +2 bullets',        fn:p=>{p.bulletCount=Math.min(p.bulletCount+2,7);}},
  {tier:'R',ic:'💫',n:'PIERCING',     col:'#ff00cc',d:'Bullets pierce enemies', fn:p=>{p.piercing=true;}},
  {tier:'R',ic:'🛡',n:'SHIELD CORE', col:'#0088ff',d:'Gain 60 shield',         fn:p=>{p.maxShield+=60;p.shield=Math.min(p.maxShield,p.shield+60);}},
  {tier:'R',ic:'⚗',n:'DUAL FIRE',   col:'#ff00cc',d:'Parallel extra shot',     fn:p=>{p.dualFire=true;}},
  {tier:'R',ic:'🔮',n:'HASTE',        col:'#cc00ff',d:'Bullet speed +35%',      fn:p=>{p.bulletSpd*=1.35;}},
  {tier:'R',ic:'💣',n:'HEAVY',        col:'#ff8800',d:'Dmg +40% rate -15%',     fn:p=>{p.bulletDmg=~~(p.bulletDmg*1.4);p.fireRate=~~(p.fireRate*1.15);}},
  {tier:'E',ic:'☄',n:'RAILGUN',      col:'#ffee00',d:'Switch: RAILGUN',         fn:(_,g)=>{g.setWep('RAILGUN');}},
  {tier:'E',ic:'🌊',n:'LASER CORE',  col:'#ff00cc',d:'Switch: LASER',           fn:(_,g)=>{g.setWep('LASER');}},
  {tier:'E',ic:'✦',n:'NOVA SYS',     col:'#cc00ff',d:'Switch: NOVA',            fn:(_,g)=>{g.setWep('NOVA');}},
  {tier:'E',ic:'❋',n:'SCATTER SYS',  col:'#ff8800',d:'Switch: SCATTER',         fn:(_,g)=>{g.setWep('SCATTER');}},
  {tier:'E',ic:'💎',n:'OVERDRIVE',   col:'#ffee00',d:'Dmg×1.6, rate -40%',      fn:p=>{p.bulletDmg=~~(p.bulletDmg*1.6);p.fireRate=Math.max(6,~~(p.fireRate*.6));}},
  {tier:'E',ic:'🧬',n:'EVOLUTION X', col:'#00ffcc',d:'All stats +10%',          fn:p=>{p.maxHp+=25;p.spd*=1.1;p.bulletDmg=~~(p.bulletDmg*1.1);p.hp=Math.min(p.maxHp,p.hp+25);}},
];

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
let game, input;
let walkable = [];
let highScore = {score:0,wave:0,kills:0};
try { const h=JSON.parse(localStorage.getItem('vp2_hs')||'{}'); if(h.score) highScore=h; } catch(e){}
function saveHS() { try{localStorage.setItem('vp2_hs',JSON.stringify(highScore));}catch(e){} }
function updateHSDisplay() {
  document.getElementById('hs-score').textContent=String(highScore.score).padStart(6,'0');
  document.getElementById('hs-wave').textContent=String(highScore.wave).padStart(2,'0');
  document.getElementById('hs-kills').textContent=String(highScore.kills).padStart(3,'0');
}
updateHSDisplay();

function initInput() { input={move:{x:0,y:0},fire:{x:0,y:0,active:false},keys:{},dash:false}; }
function initGame() {
  game={
    running:false,paused:false,
    wave:1,kills:0,score:0,t:0,
    combo:0,comboTimer:0,comboMult:1,
    waveTimer:0,waveDelay:210,betweenWaves:false,
    bossActive:false,boss:null,
    arenaMode:false,arenaRoom:null,arenaEnemiesLeft:0,
    map:[],rooms:[],arenas:[],
    player:null,camera:{x:0,y:0},
    bullets:[],eBullets:[],enemies:[],
    particles:[],floats:[],pickups:[],
    statusTimer:0,
    currentWep:'PULSE',
    setWep,
    pathCache:new Map(),
    pathCacheTimer:0,
  };
}

// ═══════════════════════════════════════
//  MAP GENERATION (Mixed)
// ═══════════════════════════════════════
function generateMap() {
  const map = Array.from({length:MAP_H},()=>Array(MAP_W).fill(1));
  const rooms = [], arenas = [];

  // Regular rooms
  for (let i=0;i<90;i++) {
    const rw=5+~~(Math.random()*10), rh=4+~~(Math.random()*8);
    const rx=2+~~(Math.random()*(MAP_W-rw-4)), ry=2+~~(Math.random()*(MAP_H-rh-4));
    if (rooms.some(r=>rx<r.x+r.w+3&&rx+rw+3>r.x&&ry<r.y+r.h+3&&ry+rh+3>r.y)) continue;
    for (let y=ry;y<ry+rh;y++) for (let x=rx;x<rx+rw;x++) map[y][x]=0;
    rooms.push({x:rx,y:ry,w:rw,h:rh,cx:~~(rx+rw/2),cy:~~(ry+rh/2)});
  }

  // Connect all rooms with corridors (MST-like)
  const connected=[rooms[0]], unconn=[...rooms.slice(1)];
  while (unconn.length) {
    let best=null,bestDist=Infinity,bestFrom=null;
    for (const u of unconn) for (const c of connected) {
      const d=Math.hypot(u.cx-c.cx,u.cy-c.cy);
      if (d<bestDist){bestDist=d;best=u;bestFrom=c;}
    }
    if (best) {
      let x=bestFrom.cx,y=bestFrom.cy;
      while(x!==best.cx){map[y][x]=0;x+=x<best.cx?1:-1;}
      while(y!==best.cy){map[y][x]=0;y+=y<best.cy?1:-1;}
      connected.push(best); unconn.splice(unconn.indexOf(best),1);
    }
  }

  // Add special ARENA rooms (larger, isolated with door markers)
  const arenaCount = 3;
  for (let i=0;i<arenaCount;i++) {
    const aw=10+~~(Math.random()*6), ah=8+~~(Math.random()*5);
    const ax=2+~~(Math.random()*(MAP_W-aw-4)), ay=2+~~(Math.random()*(MAP_H-ah-4));
    if ([...rooms,...arenas].some(r=>ax<r.x+r.w+4&&ax+aw+4>r.x&&ay<r.y+r.h+4&&ay+ah+4>r.y)) continue;
    for (let y=ay;y<ay+ah;y++) for (let x=ax;x<ax+aw;x++) map[y][x]=0;
    // Arena walls with corner pillars
    map[ay+1][ax+1]=1; map[ay+1][ax+aw-2]=1;
    map[ay+ah-2][ax+1]=1; map[ay+ah-2][ax+aw-2]=1;
    // Connect arena to nearest room
    const nr=rooms.reduce((b,r)=>{
      const d=Math.hypot(~~(ax+aw/2)-r.cx,~~(ay+ah/2)-r.cy);
      return d<b.d?{r,d}:b;
    },{r:rooms[0],d:Infinity}).r;
    let x=~~(ax+aw/2),y=~~(ay+ah/2);
    while(x!==nr.cx){map[y][x]=0;x+=x<nr.cx?1:-1;}
    while(y!==nr.cy){map[y][x]=0;y+=y<nr.cy?1:-1;}
    arenas.push({x:ax,y:ay,w:aw,h:ah,cx:~~(ax+aw/2),cy:~~(ay+ah/2),cleared:false,triggered:false});
  }

  // Decor: pillars in big rooms
  rooms.forEach(r=>{
    if(r.w>=9&&r.h>=7&&Math.random()<.45) {
      map[r.y+2][r.x+2]=1; map[r.y+2][r.x+r.w-3]=1;
      map[r.y+r.h-3][r.x+2]=1; map[r.y+r.h-3][r.x+r.w-3]=1;
    }
  });

  return {map,rooms,arenas};
}

// ═══════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════
function mkPlayer(x,y) {
  return {
    x,y,vx:0,vy:0,w:14,h:14,
    hp:100,maxHp:100,shield:0,maxShield:0,shRegenCd:0,
    spd:2.5,
    xp:0,xpNext:12,level:1,
    fireRate:18,fireCd:0,
    bulletSpd:6.5,bulletDmg:18,bulletCount:1,bulletRange:75,
    piercing:false,dualFire:false,
    invFrames:0,angle:0,trail:[],
    dashCd:0,dashMaxCd:85,dashForce:0,dashDx:0,dashDy:0,
    totalDmgDealt:0,totalDmgTaken:0,
  };
}

// ═══════════════════════════════════════
//  ENEMY CREATION + AI
// ═══════════════════════════════════════
function mkEnemy(typeId, wave, spawnX, spawnY) {
  const def = ENEMY_DEFS[typeId];
  const hpScale = 1+(wave-1)*.1;
  let sx=spawnX, sy=spawnY;
  if (sx===undefined) {
    const r=game.rooms[~~(Math.random()*game.rooms.length)];
    const a=Math.random()*Math.PI*2, d=100+Math.random()*80;
    sx=r.cx*TILE+Math.cos(a)*d; sy=r.cy*TILE+Math.sin(a)*d;
  }
  return {
    ...def,
    x:sx,y:sy,vx:0,vy:0,
    maxHp:~~(def.hp*hpScale), hp:~~(def.hp*hpScale),
    fireCd:~~(Math.random()*Math.max(def.fire||1,1)),
    flashTimer:0,angle:0,wobble:Math.random()*Math.PI*2,
    alive:true,
    // AI state
    state:ES.CHASE,
    pathTimer:0, path:null, pathIdx:0,
    stateTimer:0,
    flankAngle: Math.random()*Math.PI*2,
    alertRange: def.elite ? 350 : 220,
    attackRange: def.fire>0 ? 260 : 40,
    retreatHp: def.hp * .25,
    lastSeenPlayer:{x:sx,y:sy},
    aiDecisionCd:0, // for Claude API calls
    aiAction:null,  // last AI decision from Claude
    groupId:-1,
    splitDone:false,
  };
}

// ── Claude API Elite AI ───────────────
async function queryEliteAI(enemy, playerState) {
  const prompt = `You are the AI controller for an elite enemy in a roguelike game called VOID PROTOCOL.
Enemy: ${enemy.name}, HP: ${enemy.hp}/${enemy.maxHp}, Position: (${~~enemy.x},${~~enemy.y})
Player: HP: ${playerState.hp}/${playerState.maxHp}, Position: (${~~playerState.x},${~~playerState.y}), Shield: ${playerState.shield}
Distance to player: ${~~Math.hypot(enemy.x-playerState.x,enemy.y-playerState.y)}px
Current enemy state: ${enemy.state}

Choose ONE action for the next 3 seconds. Reply with ONLY a JSON object, no other text:
{"action":"chase"|"flank"|"retreat"|"ambush"|"suppressive_fire", "reason":"brief reason", "aggression":0.0-1.0}
- chase: direct rush toward player
- flank: circle around player from side
- retreat: move away, recover, then attack
- ambush: find cover, wait for player to come close
- suppressive_fire: stay at range, shoot rapidly`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:100,
        messages:[{role:'user',content:prompt}]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g,'').trim();
    return JSON.parse(clean);
  } catch(e) {
    return {action:'chase',reason:'fallback',aggression:0.5};
  }
}

// ── Group assignment ──────────────────
function assignGroups() {
  const RADIUS = 200;
  let groupId = 0;
  game.enemies.forEach(e => { if(e.alive) e.groupId=-1; });
  game.enemies.forEach(e => {
    if(!e.alive||e.groupId>=0) return;
    e.groupId=groupId;
    game.enemies.forEach(f => {
      if(!f.alive||f===e||f.groupId>=0) return;
      if(Math.hypot(e.x-f.x,e.y-f.y)<RADIUS) f.groupId=groupId;
    });
    groupId++;
  });
}

// ═══════════════════════════════════════
//  TILE / COLLISION
// ═══════════════════════════════════════
function tAt(wx,wy) {
  const tx=~~(wx/TILE),ty=~~(wy/TILE);
  if(tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) return 1;
  return game.map[ty][tx];
}
function moveE(e,vx,vy,hw=10,hh=10) {
  if(tAt(e.x+vx-hw,e.y-hh)===0&&tAt(e.x+vx+hw,e.y-hh)===0&&
     tAt(e.x+vx-hw,e.y+hh)===0&&tAt(e.x+vx+hw,e.y+hh)===0) e.x+=vx;
  if(tAt(e.x-hw,e.y+vy-hh)===0&&tAt(e.x+hw,e.y+vy-hh)===0&&
     tAt(e.x-hw,e.y+vy+hh)===0&&tAt(e.x+hw,e.y+vy+hh)===0) e.y+=vy;
}

// ─ Line of sight check ───────────────
function hasLOS(ax,ay,bx,by) {
  const dx=bx-ax,dy=by-ay,dist=Math.hypot(dx,dy);
  const steps=~~(dist/TILE)+1;
  for(let i=1;i<steps;i++) {
    const t=i/steps;
    if(tAt(ax+dx*t,ay+dy*t)===1) return false;
  }
  return true;
}

// ═══════════════════════════════════════
//  PARTICLES & FLOATS
// ═══════════════════════════════════════
function spark(x,y,col,n=8,s=2.5,grav=false) {
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,sp=s*(.4+Math.random()*.8);
    game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
      life:25+~~(Math.random()*25),maxLife:50,col,r:1.5+Math.random()*2.5,grav});
  }
}
function floatText(x,y,text,col='#fff') {
  game.floats.push({x,y,text,col,life:55,maxLife:55,vy:-.9});
}

// ═══════════════════════════════════════
//  WAVE / ARENA SYSTEM
// ═══════════════════════════════════════
function getWaveCfg(wave) {
  const isBoss = wave%5===0;
  const cnt = 6+wave*2;
  let types=[0];
  if(wave>=2) types.push(3);
  if(wave>=3) types.push(1);
  if(wave>=4) types.push(5);
  if(wave>=5) types.push(2);
  if(wave>=6) types.push(6);
  if(wave>=7) types.push(4);
  if(wave>=8) types.push(7);
  // Add elite every 3 waves
  if(wave>=3&&wave%3===0) types.push(8,9);
  if(wave>=6&&wave%6===0) types.push(10,11,12);
  return {isBoss,cnt,types};
}

function startWave() {
  game.betweenWaves=false;
  game.bossActive=false;
  game.boss=null;
  game.enemies=[];game.bullets=[];game.eBullets=[];
  document.getElementById('boss-hud').classList.add('hidden');
  document.getElementById('arena-indicator').classList.add('hidden');

  const cfg=getWaveCfg(game.wave);
  if(cfg.isBoss) { showBossWarn(); return; }

  for(let i=0;i<cfg.cnt;i++) {
    const t=cfg.types[~~(Math.random()*cfg.types.length)];
    game.enemies.push(mkEnemy(t,game.wave));
  }
  assignGroups();
  setStatus(`[ WAVE ${game.wave} — ${cfg.cnt} PROCESSES DETECTED ]`,150);

  // Check arena trigger
  checkArenaTrigger();
}

function checkArenaTrigger() {
  if(game.wave<2) return;
  for(const arena of game.arenas) {
    if(!arena.cleared&&!arena.triggered) {
      arena.triggered=true;
      showArenaPrompt(arena);
      break;
    }
  }
}

function showArenaPrompt(arena) {
  const names=['SECTOR-7 DEATH GRID','SECTOR-12 CORRUPTION ZONE','SECTOR-X VOID CHAMBER'];
  const descs=['Survive elite gauntlet — no escape','Kill all to unlock the exit','Boss minions await inside'];
  const idx=game.arenas.indexOf(arena);
  document.getElementById('arena-name').textContent=names[idx]||'ARENA';
  document.getElementById('arena-desc').textContent=descs[idx]||'Survive';
  showScreen('arena-screen');
  document.getElementById('arena-enter-btn').onclick=()=>{
    hideScreen('arena-screen');
    startArena(arena);
  };
}

function startArena(arena) {
  game.arenaMode=true;
  game.arenaRoom=arena;
  // Teleport player into arena
  game.player.x=arena.cx*TILE; game.player.y=arena.cy*TILE;
  game.camera.x=game.player.x-canvas.width/2;
  game.camera.y=game.player.y-canvas.height/2;
  // Spawn elite enemies inside arena
  const cnt=6+game.wave;
  const eliteTypes=[8,9,10,11,12];
  for(let i=0;i<cnt;i++) {
    const t=eliteTypes[~~(Math.random()*eliteTypes.length)];
    const a=Math.random()*Math.PI*2,d=80+Math.random()*60;
    const sx=arena.cx*TILE+Math.cos(a)*d, sy=arena.cy*TILE+Math.sin(a)*d;
    game.enemies.push(mkEnemy(t,game.wave,sx,sy));
  }
  game.arenaEnemiesLeft=game.enemies.length;
  document.getElementById('arena-indicator').classList.remove('hidden');
  document.getElementById('arena-enemies-left').textContent=`${game.arenaEnemiesLeft} LEFT`;
  setStatus(`[ ARENA LOCKED — ELIMINATE ALL PROCESSES ]`,200);
}

function checkArenaClear() {
  if(!game.arenaMode) return;
  const alive=game.enemies.filter(e=>e.alive).length;
  document.getElementById('arena-enemies-left').textContent=`${alive} LEFT`;
  if(alive===0) {
    game.arenaMode=false;
    game.arenaRoom.cleared=true;
    document.getElementById('arena-indicator').classList.add('hidden');
    // Drop lots of pickups
    for(let i=0;i<8;i++)
      game.pickups.push(mkPickup(
        game.arenaRoom.cx*TILE+(Math.random()-.5)*80,
        game.arenaRoom.cy*TILE+(Math.random()-.5)*80
      ));
    game.score+=2000;
    setStatus(`[ ARENA CLEARED — BONUS: +2000 ]`,200);
  }
}

function showBossWarn() {
  const bIdx=~~(game.wave/5)-1;
  const bDef=BOSS_DEFS[bIdx%BOSS_DEFS.length];
  document.getElementById('bw-name').textContent=bDef.name;
  showScreen('boss-screen');
  setTimeout(()=>{hideScreen('boss-screen');spawnBoss(bIdx);},3200);
}

function spawnBoss(bIdx) {
  const def=BOSS_DEFS[bIdx%BOSS_DEFS.length];
  const r=game.rooms[~~(game.rooms.length/2)];
  game.boss={
    ...def,x:r.cx*TILE,y:r.cy*TILE,
    hp:def.hp,maxHp:def.hp,phase:1,phaseChanged:false,
    alive:true,wobble:0,flashTimer:0,fireCd:0,
    atkTimer:0,atkState:'idle',
    chargeDx:0,chargeDy:0,
  };
  game.bossActive=true;
  document.getElementById('boss-hud').classList.remove('hidden');
  document.getElementById('boss-hud-name').textContent=def.name;
  document.getElementById('boss-phase').textContent='PHASE 1';
  setStatus(`[ ${def.name} MANIFESTED ]`,200);
}

function setStatus(msg,dur=90) {
  const el=document.getElementById('status-msg');
  el.textContent=msg; el.classList.add('vis');
  game.statusTimer=dur;
}

// ═══════════════════════════════════════
//  UPDATE LOOP
// ═══════════════════════════════════════
function update() {
  if(!game.running||game.paused) return;
  game.t++;
  updateShake();
  if(game.statusTimer>0&&--game.statusTimer===0)
    document.getElementById('status-msg').classList.remove('vis');

  if(game.betweenWaves){
    if(++game.waveTimer>=game.waveDelay) startWave();
    return;
  }

  updatePlayer();
  updateBullets();
  updateEBullets();
  updateEnemies();
  if(game.bossActive&&game.boss?.alive) updateBoss();
  updatePickups();
  updateParticles();
  updateFloats();
  updateCombo();
  updateDashUI();
  updateHUD();
}

// ─ PLAYER ────────────────────────────
function updatePlayer() {
  const p=game.player;

  if(p.dashForce>0) {
    moveE(p,p.dashDx*p.dashForce,p.dashDy*p.dashForce,7,7);
    p.dashForce-=.65;
    spark(p.x,p.y,'#00fff7',2,1.5);
    if(p.dashForce<=0) p.dashForce=0;
    return;
  }

  let dx=input.move.x,dy=input.move.y;
  if(input.keys['w']||input.keys['ArrowUp'])    dy=-1;
  if(input.keys['s']||input.keys['ArrowDown'])  dy= 1;
  if(input.keys['a']||input.keys['ArrowLeft'])  dx=-1;
  if(input.keys['d']||input.keys['ArrowRight']) dx= 1;
  const len=Math.sqrt(dx*dx+dy*dy);
  if(len>0.01){if(len>1){dx/=len;dy/=len;} moveE(p,dx*p.spd,dy*p.spd,7,7);}

  if(input.fire.active&&(Math.abs(input.fire.x)>.05||Math.abs(input.fire.y)>.05))
    p.angle=Math.atan2(input.fire.y,input.fire.x);
  else if(len>.05) p.angle=Math.atan2(dy,dx);

  p.trail.unshift({x:p.x,y:p.y});
  if(p.trail.length>10) p.trail.pop();

  if(p.fireCd>0) p.fireCd--;
  if((input.fire.active||input.keys[' ']||input.keys['z'])&&p.fireCd===0) shootPlayer();

  if(input.dash&&p.dashCd===0) {
    p.dashDx=len>.05?dx/len:Math.cos(p.angle);
    p.dashDy=len>.05?dy/len:Math.sin(p.angle);
    p.dashForce=8; p.dashCd=p.dashMaxCd; p.invFrames=28;
    spark(p.x,p.y,'#00fff7',22,3.5);
    input.dash=false;
  }
  if(p.dashCd>0) p.dashCd--;

  if(p.maxShield>0&&p.shield<p.maxShield) {
    if(++p.shRegenCd>=200){p.shield=Math.min(p.maxShield,p.shield+1);p.shRegenCd=180;}
  }
  if(p.invFrames>0) p.invFrames--;

  game.camera.x+=(p.x-canvas.width/2-game.camera.x)*.13;
  game.camera.y+=(p.y-canvas.height/2-game.camera.y)*.13;

  // Arena proximity trigger
  if(!game.arenaMode) {
    for(const arena of game.arenas) {
      if(!arena.cleared&&!arena.triggered) {
        if(Math.hypot(p.x-arena.cx*TILE,p.y-arena.cy*TILE)<120) {
          arena.triggered=true; showArenaPrompt(arena);
        }
      }
    }
  }
}

function shootPlayer() {
  const p=game.player;
  p.fireCd=p.fireRate;
  const w=WEAPONS[game.currentWep];
  const spread=(p.bulletCount-1)*(w.spread||.18);
  for(let i=0;i<p.bulletCount;i++){
    const ba=p.bulletCount===1?p.angle:(p.angle-spread/2+i*(spread/Math.max(p.bulletCount-1,1)));
    game.bullets.push({x:p.x,y:p.y,vx:Math.cos(ba)*p.bulletSpd,vy:Math.sin(ba)*p.bulletSpd,
      dmg:p.bulletDmg,pier:p.piercing,col:w.col,life:~~(p.bulletRange*1.2),r:4,trail:[]});
  }
  if(p.dualFire) {
    const pa=p.angle+Math.PI/2;
    game.bullets.push({x:p.x+Math.cos(pa)*7,y:p.y+Math.sin(pa)*7,
      vx:Math.cos(p.angle)*p.bulletSpd,vy:Math.sin(p.angle)*p.bulletSpd,
      dmg:~~(p.bulletDmg*.65),pier:p.piercing,col:w.col+'99',life:~~(p.bulletRange*.85),r:3,trail:[]});
  }
  spark(p.x+Math.cos(p.angle)*14,p.y+Math.sin(p.angle)*14,w.col,3,1.5);
}

// ─ BULLETS ───────────────────────────
function updateBullets() {
  game.bullets=game.bullets.filter(b=>{
    b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>6)b.trail.pop();
    b.x+=b.vx;b.y+=b.vy;b.life--;
    if(b.life<=0||tAt(b.x,b.y)===1){spark(b.x,b.y,b.col,3,1);return false;}
    let hit=false;
    game.enemies.forEach(e=>{
      if(!e.alive||hit) return;
      if(e.ghost&&Math.random()<.35) return;
      if(Math.hypot(b.x-e.x,b.y-e.y)<e.sz+b.r){
        damageEnemy(e,b.dmg,b.col); if(!b.pier) hit=true;
      }
    });
    if(game.bossActive&&game.boss?.alive&&!hit) {
      if(Math.hypot(b.x-game.boss.x,b.y-game.boss.y)<game.boss.sz+b.r){
        damageBoss(b.dmg); if(!b.pier) hit=true;
      }
    }
    return !hit;
  });
}

function damageEnemy(e,dmg,col) {
  e.hp-=dmg; e.flashTimer=7;
  game.player.totalDmgDealt+=dmg;
  spark(e.x,e.y,e.col,4,1.8);
  floatText(e.x,e.y-e.sz,dmg,col);
  if(e.hp<=0) {
    e.alive=false;
    game.kills++; game.score+=e.sc*game.comboMult;
    game.player.xp+=e.xp;
    incCombo();
    spark(e.x,e.y,e.col,20,3.5,true);
    triggerShake(e.elite?8:4);
    if(e.splits&&!e.splitDone){
      for(let i=0;i<3;i++){
        const mini=mkEnemy(0,game.wave,e.x+(Math.random()-.5)*40,e.y+(Math.random()-.5)*40);
        mini.sz=6;mini.hp=12;mini.maxHp=12;mini.sc=30;
        game.enemies.push(mini);
      }
    }
    if(e.bomber){
      for(let i=0;i<360;i+=20){
        const a=i*Math.PI/180;
        game.eBullets.push({x:e.x,y:e.y,vx:Math.cos(a)*4.5,vy:Math.sin(a)*4.5,dmg:18,r:6,life:45,col:'#ff4400'});
      }
      spark(e.x,e.y,'#ff4400',35,6,true); triggerShake(12);
    }
    if(Math.random()<(e.elite?.55:.28)) game.pickups.push(mkPickup(e.x,e.y));
    if(game.arenaMode) checkArenaClear();
  }
}

function damageBoss(dmg) {
  const b=game.boss;
  b.hp-=dmg; b.flashTimer=5;
  game.player.totalDmgDealt+=dmg;
  spark(b.x,b.y,b.col,5,2);
  floatText(b.x,b.y-b.sz,dmg,b.col);
  if(!b.phaseChanged&&b.hp<=b.p2hp){
    b.phase=2;b.phaseChanged=true;b.spd*=1.35;
    spark(b.x,b.y,b.col,50,6);
    document.getElementById('boss-phase').textContent='PHASE 2';
    setStatus(`[ ${b.name} — PHASE 2 CRITICAL ]`,150);
  }
  if(b.hp<=0){
    b.alive=false; game.bossActive=false;
    game.kills++; game.score+=b.sc;
    game.player.xp+=35;
    spark(b.x,b.y,b.col,60,7,true); triggerShake(20);
    for(let i=0;i<8;i++) game.pickups.push(mkPickup(b.x+(Math.random()-.5)*100,b.y+(Math.random()-.5)*100));
    document.getElementById('boss-hud').classList.add('hidden');
    setStatus(`[ ${b.name} ELIMINATED ]`,220);
    endWave();
  }
  document.getElementById('boss-hud-fill').style.width=(Math.max(0,b.hp)/b.maxHp*100)+'%';
}

// ─ ENEMY BULLETS ─────────────────────
function updateEBullets() {
  game.eBullets=game.eBullets.filter(b=>{
    b.x+=b.vx;b.y+=b.vy;b.life--;
    if(b.life<=0||tAt(b.x,b.y)===1) return false;
    const p=game.player;
    if(p.invFrames>0) return true;
    if(Math.hypot(b.x-p.x,b.y-p.y)<12+b.r){hurtPlayer(b.dmg);return false;}
    return true;
  });
}

// ─ ENEMY AI ──────────────────────────
function updateEnemies() {
  game.enemies=game.enemies.filter(e=>e.alive!==false);
  const p=game.player;

  // Path cache refresh
  if(++game.pathCacheTimer>120){game.pathCache.clear();game.pathCacheTimer=0;}

  game.enemies.forEach((e,idx)=>{
    e.wobble+=.05;
    if(e.flashTimer>0) e.flashTimer--;
    e.stateTimer++;
    if(e.aiDecisionCd>0) e.aiDecisionCd--;

    const dx=p.x-e.x, dy=p.y-e.y;
    const dist=Math.hypot(dx,dy);
    e.angle=Math.atan2(dy,dx);

    const canSee=dist<e.alertRange&&hasLOS(e.x,e.y,p.x,p.y);
    if(canSee) e.lastSeenPlayer={x:p.x,y:p.y};

    // Elite AI: ask Claude periodically
    if(e.elite&&e.aiDecisionCd===0&&dist<e.alertRange) {
      e.aiDecisionCd=180+~~(Math.random()*60); // every ~3s
      queryEliteAI(e,p).then(decision=>{
        if(!e.alive) return;
        e.aiAction=decision;
        // Apply Claude decision
        switch(decision.action) {
          case 'flank':    e.state=ES.FLANK; break;
          case 'retreat':  e.state=ES.RETREAT; break;
          case 'ambush':   e.state=ES.AMBUSH; break;
          case 'suppressive_fire': e.state=ES.CHASE; e.fireCd=0; break;
          default:         e.state=ES.CHASE;
        }
      });
    }

    // Non-elite: state machine based on conditions
    if(!e.elite) {
      if(e.hp<=e.retreatHp&&dist<180) e.state=ES.RETREAT;
      else if(!canSee&&e.state!==ES.PATROL) {
        if(e.stateTimer>90) { e.state=ES.PATROL; e.stateTimer=0; }
      }
      else if(canSee) {
        // Warlords lead group to flank
        if(e.leads&&game.t%120===idx%120) {
          e.state=ES.FLANK;
          const groupMembers=game.enemies.filter(f=>f.alive&&f.groupId===e.groupId&&f!==e);
          groupMembers.forEach((f,fi)=>{f.state=fi%2===0?ES.FLANK:ES.CHASE;});
        } else if(e.state!==ES.FLANK) {
          e.state=ES.CHASE;
        }
      }
    }

    // Execute state
    switch(e.state) {
      case ES.CHASE:   doChase(e,p,dx,dy,dist); break;
      case ES.FLANK:   doFlank(e,p,dist); break;
      case ES.RETREAT: doRetreat(e,p,dx,dy,dist); break;
      case ES.PATROL:  doPatrol(e); break;
      case ES.AMBUSH:  doAmbush(e,p,dist); break;
    }

    // Ranged attack
    doRangedAttack(e,p,dist,canSee);

    // Melee
    if(dist<e.sz+12&&p.invFrames===0) hurtPlayer(e.dmg);
  });

  if(game.enemies.length===0&&!game.betweenWaves&&!game.bossActive&&!game.arenaMode) endWave();
}

// ── Pathfinding movement toward target ──
function moveToward(e, tx, ty) {
  const dx=tx-e.x, dy=ty-e.y, dist=Math.hypot(dx,dy);
  if(dist<8){return;}

  // Try direct movement first
  const ndx=dx/dist*e.spd, ndy=dy/dist*e.spd;
  const prevX=e.x, prevY=e.y;
  moveE(e,ndx,ndy,e.sz*.85,e.sz*.85);

  // If stuck (wall), use A* pathfinding
  if(e.x===prevX&&e.y===prevY) {
    if(e.pathTimer<=0 || !e.path) {
      e.pathTimer=45;
      const sp=worldToPG(e.x,e.y), ep=worldToPG(tx,ty);
      const cacheKey=`${sp.x},${sp.y}-${ep.x},${ep.y}`;
      if(game.pathCache.has(cacheKey)) {
        e.path=game.pathCache.get(cacheKey);
        e.pathIdx=0;
      } else {
        const p=astar(walkable,sp.x,sp.y,ep.x,ep.y);
        game.pathCache.set(cacheKey,p);
        e.path=p; e.pathIdx=0;
      }
    }
    e.pathTimer--;
    if(e.path&&e.pathIdx<e.path.length) {
      const node=e.path[e.pathIdx];
      const nw=pgToWorld(node.x,node.y);
      const pdx=nw.x-e.x, pdy=nw.y-e.y, pd=Math.hypot(pdx,pdy);
      if(pd<TILE*PATH_GRID_SCALE*.8) e.pathIdx++;
      else {
        const mv=e.spd/pd;
        moveE(e,pdx*mv,pdy*mv,e.sz*.85,e.sz*.85);
      }
    }
  } else {
    e.path=null; // clear path when moving freely
  }
}

function doChase(e,p,dx,dy,dist) {
  moveToward(e,p.x,p.y);
}

function doFlank(e,p,dist) {
  e.flankAngle+=.02*(e.elite?1.4:1);
  const targetDist=150+(e.elite?50:0);
  const tx=p.x+Math.cos(e.flankAngle)*targetDist;
  const ty=p.y+Math.sin(e.flankAngle)*targetDist;
  moveToward(e,tx,ty);
  // Close in when close enough
  if(dist<80) e.state=ES.CHASE;
}

function doRetreat(e,p,dx,dy,dist) {
  const tx=e.x-dx/dist*e.spd*1.4;
  const ty=e.y-dy/dist*e.spd*1.4;
  moveE(e,tx-e.x,ty-e.y,e.sz*.85,e.sz*.85);
  if(e.hp>e.retreatHp*1.5||dist>250) e.state=ES.CHASE;
}

function doPatrol(e) {
  if(!e.patrolTarget||Math.hypot(e.x-e.patrolTarget.x,e.y-e.patrolTarget.y)<20){
    const r=game.rooms[~~(Math.random()*game.rooms.length)];
    e.patrolTarget={x:r.cx*TILE,y:r.cy*TILE};
  }
  moveToward(e,e.patrolTarget.x,e.patrolTarget.y);
}

function doAmbush(e,p,dist) {
  // Find cover (wall adjacent tile) and wait
  if(!e.ambushPos) {
    const a=Math.random()*Math.PI*2;
    e.ambushPos={x:e.x+Math.cos(a)*60,y:e.y+Math.sin(a)*60};
  }
  moveToward(e,e.ambushPos.x,e.ambushPos.y);
  if(dist<120) { e.state=ES.CHASE; e.ambushPos=null; }
}

function doRangedAttack(e,p,dist,canSee) {
  if(!e.fire||e.fire===0) return;
  if(e.fireCd>0){e.fireCd--;return;}
  if(!canSee||dist>e.attackRange) return;
  e.fireCd=e.fire;

  const a=Math.atan2(p.y-e.y,p.x-e.x);
  const accuracy=e.elite?0.06:0.18; // elites are more accurate
  const jitter=(Math.random()-.5)*accuracy;

  // Sniper: slow but accurate burst
  if(e.id===4||e.id===9) {
    for(let i=0;i<2;i++) setTimeout(()=>{
      if(!e.alive) return;
      const a2=Math.atan2(p.y-e.y,p.x-e.x);
      game.eBullets.push({x:e.x,y:e.y,vx:Math.cos(a2)*5.5,vy:Math.sin(a2)*5.5,dmg:e.dmg,r:5,life:100,col:e.col});
    },i*120);
  } else {
    game.eBullets.push({x:e.x,y:e.y,vx:Math.cos(a+jitter)*4,vy:Math.sin(a+jitter)*4,dmg:e.dmg,r:5,life:90,col:e.col});
  }

  // Elite shooter: fires 3-shot burst
  if(e.id===9) {
    for(let i=1;i<3;i++) setTimeout(()=>{
      if(!e.alive) return;
      const a2=Math.atan2(p.y-e.y,p.x-e.x);
      game.eBullets.push({x:e.x,y:e.y,vx:Math.cos(a2+(Math.random()-.5)*.08)*4,
        vy:Math.sin(a2+(Math.random()-.5)*.08)*4,dmg:e.dmg*.7,r:5,life:90,col:e.col});
    },i*80);
  }
}

// ─ BOSS ──────────────────────────────
function updateBoss() {
  const b=game.boss,p=game.player;
  b.wobble+=.04; if(b.flashTimer>0) b.flashTimer--;
  const dx=p.x-b.x,dy=p.y-b.y,dist=Math.hypot(dx,dy);
  b.angle=Math.atan2(dy,dx);
  b.atkTimer++;
  const atkInt=b.phase===2?70:110;
  if(b.atkTimer>=atkInt){b.atkTimer=0;doBossAtk(b,b.atks[~~(Math.random()*b.atks.length)],p);}
  if(b.atkState!=='charge'){
    const td=200;
    if(dist>td) moveToward(b,p.x,p.y);
    else if(dist<td-60){const mv=b.spd*.5;moveE(b,-dx/dist*mv,-dy/dist*mv,b.sz,b.sz);}
  } else {
    moveE(b,b.chargeDx*5.5,b.chargeDy*5.5,b.sz,b.sz);
    if(Math.hypot(p.x-b.x,p.y-b.y)<b.sz+14&&p.invFrames===0) hurtPlayer(b.dmg*2.2);
    if(tAt(b.x+b.chargeDx*b.sz,b.y+b.chargeDy*b.sz)===1||b.atkTimer<=0) {
      b.atkState='idle'; spark(b.x,b.y,b.col,18,4);
    }
  }
  // Phase 2 orbit bullets
  if(b.phase===2&&game.t%45===0) {
    for(let i=0;i<4;i++){
      const a=i*(Math.PI/2)+game.t*.03;
      game.eBullets.push({x:b.x+Math.cos(a)*b.sz*2,y:b.y+Math.sin(a)*b.sz*2,
        vx:Math.cos(a+Math.PI/2)*2.8,vy:Math.sin(a+Math.PI/2)*2.8,dmg:b.dmg*.55,r:5,life:85,col:b.col});
    }
  }
  if(dist<b.sz+14&&p.invFrames===0) hurtPlayer(b.dmg);
}

function doBossAtk(b,atk,p) {
  const ba=Math.atan2(p.y-b.y,p.x-b.x);
  switch(atk){
    case 'spin':
      for(let i=0;i<14;i++){const a=i*(Math.PI*2/14)+b.wobble;
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*3.8,vy:Math.sin(a)*3.8,dmg:b.dmg*.65,r:5,life:110,col:b.col});}
      break;
    case 'charge':
      b.atkState='charge';b.chargeDx=Math.cos(ba);b.chargeDy=Math.sin(ba);b.atkTimer=18;break;
    case 'spread':
      for(let i=-4;i<=4;i++){const a=ba+i*.16;
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*4.2,vy:Math.sin(a)*4.2,dmg:b.dmg*.75,r:5,life:90,col:b.col});}
      break;
    case 'laser':
      for(let i=0;i<22;i++) setTimeout(()=>{if(!game.boss?.alive)return;
        const a2=Math.atan2(p.y-b.y,p.x-b.x)+(Math.random()-.5)*.08;
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*7,vy:Math.sin(a2)*7,dmg:b.dmg*.45,r:4,life:80,col:b.col});},i*35);
      break;
    case 'nova':
      for(let i=0;i<28;i++){const a=i*(Math.PI*2/28);
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*3.2,vy:Math.sin(a)*3.2,dmg:b.dmg*.55,r:5,life:120,col:b.col});}
      break;
    case 'summon':
      for(let i=0;i<4;i++) game.enemies.push(mkEnemy(~~(Math.random()*5),game.wave));
      setStatus(`[ ${b.name}: REINFORCEMENTS ]`,80);break;
    case 'teleport':
      const nr=game.rooms[~~(Math.random()*game.rooms.length)];
      spark(b.x,b.y,b.col,25,4); b.x=nr.cx*TILE;b.y=nr.cy*TILE; spark(b.x,b.y,b.col,25,4);break;
    case 'beam':
      for(let i=0;i<35;i++) setTimeout(()=>{if(!game.boss?.alive)return;
        const a2=Math.atan2(p.y-b.y,p.x-b.x);
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*9,vy:Math.sin(a2)*9,dmg:b.dmg,r:7,life:55,col:b.col});},i*55);
      break;
    case 'burst':
      for(let r2=0;r2<3;r2++) setTimeout(()=>{if(!game.boss?.alive)return;
        for(let i=-3;i<=3;i++){const a=Math.atan2(p.y-b.y,p.x-b.x)+i*.22;
          game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*5,vy:Math.sin(a)*5,dmg:b.dmg*.5,r:5,life:80,col:b.col});}},r2*220);
      break;
    case 'wall':
      for(let i=-7;i<=7;i++){const pa=ba+Math.PI/2;
        game.eBullets.push({x:b.x+Math.cos(pa)*i*22,y:b.y+Math.sin(pa)*i*22,
          vx:Math.cos(ba)*3.2,vy:Math.sin(ba)*3.2,dmg:b.dmg*.65,r:5,life:95,col:b.col});}
      break;
    case 'orbit':
      for(let i=0;i<40;i++) setTimeout(()=>{if(!game.boss?.alive)return;
        const a=i*(Math.PI*2/40)+game.t*.1,sp=1.8+i*.07;
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,dmg:b.dmg*.38,r:5,life:160,col:b.col});},i*28);
      break;
    case 'explode':
      for(let i=0;i<52;i++){const a=i*(Math.PI*2/52);
        game.eBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*2.8,vy:Math.sin(a)*2.8,dmg:b.dmg*.45,r:5,life:150,col:b.col});}
      spark(b.x,b.y,b.col,45,7); triggerShake(16); break;
  }
}

// ─ PICKUPS ───────────────────────────
const PICKUP_T=['hp','hp','xp','xp','shield','wep'];
function mkPickup(x,y,force){return{x,y,type:force||PICKUP_T[~~(Math.random()*PICKUP_T.length)],life:420,pulse:0};}

function updatePickups() {
  const p=game.player;
  const cols={hp:'#ff44aa',xp:'#44ffaa',shield:'#44aaff',wep:'#ffee00'};
  game.pickups=game.pickups.filter(pk=>{
    pk.life--;pk.pulse+=.08;if(pk.life<=0)return false;
    if(Math.hypot(p.x-pk.x,p.y-pk.y)<22){
      if(pk.type==='hp'){p.hp=Math.min(p.maxHp,p.hp+35);floatText(pk.x,pk.y,'HP+35','#ff44aa');}
      if(pk.type==='xp'){p.xp+=10;floatText(pk.x,pk.y,'XP+10','#44ffaa');}
      if(pk.type==='shield'){p.maxShield=Math.max(p.maxShield,40);p.shield=Math.min(p.maxShield,p.shield+40);floatText(pk.x,pk.y,'SHIELD','#44aaff');}
      if(pk.type==='wep'){offerWeaponChoice();}
      spark(pk.x,pk.y,cols[pk.type]||'#fff',10,2);
      return false;
    }
    return true;
  });
}

function offerWeaponChoice() {
  const keys=Object.keys(WEAPONS).filter(k=>k!==game.currentWep);
  const picks=keys.sort(()=>Math.random()-.5).slice(0,2);
  const fakeUpg=picks.map(k=>({
    tier:'E',ic:WEAPONS[k].ic,n:WEAPONS[k].n,col:WEAPONS[k].col,
    d:WEAPONS[k].n+' weapon system',fn:(_,g)=>{g.setWep(k);}
  }));
  showUpgradeScreen([...fakeUpg,UPGRADES[~~(Math.random()*6)]]);
}

// ─ PARTICLES ─────────────────────────
function updateParticles() {
  game.particles=game.particles.filter(pt=>{
    pt.x+=pt.vx;pt.y+=pt.vy;pt.vx*=.88;pt.vy*=.88;
    if(pt.grav)pt.vy+=.09;pt.life--;return pt.life>0;
  });
}
function updateFloats() {
  game.floats=game.floats.filter(ft=>{ft.y+=ft.vy;ft.life--;return ft.life>0;});
}

// ─ COMBO ─────────────────────────────
function incCombo(){game.combo++;game.comboTimer=130;game.comboMult=Math.min(8,1+~~(game.combo/3));}
function updateCombo(){if(game.comboTimer>0)game.comboTimer--;else{game.combo=0;game.comboMult=1;}}

// ─ HURT PLAYER ───────────────────────
function hurtPlayer(dmg) {
  const p=game.player; if(p.invFrames>0)return;
  if(p.shield>0){const abs=Math.min(p.shield,dmg);p.shield-=abs;dmg-=abs;spark(p.x,p.y,'#0088ff',6,2);p.shRegenCd=0;}
  if(dmg<=0)return;
  p.hp-=dmg; p.invFrames=40; p.totalDmgTaken+=dmg;
  spark(p.x,p.y,'#ff003c',12,3);
  floatText(p.x,p.y-22,'-'+~~dmg,'#ff003c');
  triggerShake(10);
  if(p.hp<=0){p.hp=0;endGame();}
}

function endWave() {
  game.wave++; game.betweenWaves=true; game.waveTimer=0;
  setStatus(`[ WAVE ${game.wave-1} CLEARED ]`,120);
}

function checkLevelUp() {
  const p=game.player;
  if(p.xp>=p.xpNext){p.xp-=p.xpNext;p.xpNext=~~(p.xpNext*1.45);p.level++;
    document.getElementById('upg-lv').textContent=`LEVEL UP → LVL ${p.level}`;
    showUpgradeScreen();}
}

// ─ UPGRADES ──────────────────────────
function pickUpgrades(n=3) {
  const weighted=[];
  UPGRADES.forEach(u=>{const w=u.tier==='C'?5:u.tier==='R'?2:1;for(let i=0;i<w;i++)weighted.push(u);});
  const result=[],used=new Set();
  while(result.length<n&&used.size<UPGRADES.length){
    const pick=weighted[~~(Math.random()*weighted.length)];
    if(!used.has(pick.n)){used.add(pick.n);result.push(pick);}
  }
  return result;
}

function showUpgradeScreen(overrides) {
  game.paused=true;
  const upgs=overrides||pickUpgrades(3);
  const cont=document.getElementById('upg-cards'); cont.innerHTML='';
  upgs.forEach(u=>{
    const c=document.createElement('div');
    c.className=`upg-card${u.tier==='R'?' rare':u.tier==='E'?' epic':''}`;
    c.innerHTML=`<div class="u-icon">${u.ic}</div>
      <div class="u-name" style="color:${u.col}">${u.n}</div>
      <div class="u-desc">${u.d}</div>
      <div class="u-tier" style="color:${u.col}88">${{C:'COMMON',R:'RARE',E:'EPIC'}[u.tier]}</div>`;
    c.addEventListener('click',()=>{
      u.fn(game.player,game);
      document.getElementById('upgrade-screen').classList.remove('active');
      document.getElementById('upgrade-screen').style.display='none';
      game.paused=false;
      addBuff(u.n);
      setStatus(`[ ${u.n} INSTALLED ]`,80);
    });
    cont.appendChild(c);
  });
  showScreen('upgrade-screen');
}

function setWep(id) {
  game.currentWep=id;
  const w=WEAPONS[id];
  game.player.fireRate=w.rof;
  game.player.bulletSpd=w.spd;
  game.player.bulletRange=w.range;
  document.getElementById('wep-icon').textContent=w.ic;
  document.getElementById('wep-name').textContent=w.n;
}

function addBuff(name) {
  const row=document.getElementById('buff-row');
  if(row.children.length>=8) row.removeChild(row.firstChild);
  const c=document.createElement('div'); c.className='buff-chip'; c.textContent=name;
  row.appendChild(c);
}

// ─ HUD ───────────────────────────────
function updateHUD() {
  const p=game.player;
  document.getElementById('hp-fill').style.width=(Math.max(0,p.hp)/p.maxHp*100)+'%';
  document.getElementById('hp-val').textContent=~~p.hp;
  document.getElementById('sh-fill').style.width=(p.maxShield>0?(p.shield/p.maxShield*100):0)+'%';
  document.getElementById('xp-fill').style.width=(p.xp/p.xpNext*100)+'%';
  document.getElementById('lv-val').textContent='LV'+p.level;
  document.getElementById('wave-val').textContent=String(game.wave).padStart(2,'0');
  document.getElementById('kill-val').textContent=game.kills;
  document.getElementById('score-val').textContent=String(game.score).padStart(6,'0');
  document.getElementById('combo-val').textContent='x'+game.comboMult;
  checkLevelUp();
}

function updateDashUI() {
  const p=game.player;
  const btn=document.getElementById('dash-btn');
  const cd=document.getElementById('dash-cd');
  if(p.dashCd>0){btn.classList.add('cooldown');cd.style.width=((1-p.dashCd/p.dashMaxCd)*100)+'%';}
  else{btn.classList.remove('cooldown');cd.style.width='100%';}
}

// ═══════════════════════════════════════
//  DRAW
// ═══════════════════════════════════════
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(shakeX-~~game.camera.x, shakeY-~~game.camera.y);
  drawMap();
  drawArenas();
  drawPickups();
  drawParticles();
  drawEBullets();
  drawBullets();
  drawEnemies();
  if(game.bossActive&&game.boss) drawBoss();
  drawFloats();
  drawPlayer();
  ctx.restore();
  drawMinimap();
}

// ─ MAP ───────────────────────────────
function drawMap() {
  const cam=game.camera;
  const sx=Math.max(0,~~(cam.x/TILE)), sy=Math.max(0,~~(cam.y/TILE));
  const ex=Math.min(MAP_W,sx+~~(canvas.width/TILE)+2);
  const ey=Math.min(MAP_H,sy+~~(canvas.height/TILE)+2);

  for(let ty=sy;ty<ey;ty++) for(let tx=sx;tx<ex;tx++) {
    const wx=tx*TILE,wy=ty*TILE;
    if(game.map[ty][tx]===1){
      ctx.fillStyle='#06001e'; ctx.fillRect(wx,wy,TILE,TILE);
      ctx.fillStyle='#09002a'; ctx.fillRect(wx+1,wy+1,TILE-2,TILE-2);
      // subtle edge
      ctx.fillStyle='#0e0038'; ctx.fillRect(wx+1,wy+1,TILE-2,1); ctx.fillRect(wx+1,wy+1,1,TILE-2);
    } else {
      ctx.fillStyle='#010012'; ctx.fillRect(wx,wy,TILE,TILE);
      ctx.strokeStyle='#040018'; ctx.lineWidth=.5; ctx.strokeRect(wx+.5,wy+.5,TILE-1,TILE-1);
    }
  }
}

function drawArenas() {
  game.arenas.forEach(a=>{
    if(a.cleared) return;
    // Arena glow border
    const wx=a.x*TILE,wy=a.y*TILE,ww=a.w*TILE,wh=a.h*TILE;
    const pulse=.4+.3*Math.sin(game.t*.08);
    ctx.strokeStyle=`rgba(255,238,0,${pulse})`;
    ctx.lineWidth=2; ctx.strokeRect(wx,wy,ww,wh);
    // Label
    if(!a.triggered){
      ctx.fillStyle=`rgba(255,238,0,${pulse})`;
      ctx.font=`bold 11px 'Orbitron',monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⚔ ARENA',a.cx*TILE,a.cy*TILE);
    }
  });
}

// ─ PLAYER ────────────────────────────
function drawPlayer() {
  const p=game.player, t=game.t;
  p.trail.forEach((pt,i)=>{
    const a=(1-i/p.trail.length)*.38, r=8*(1-i/p.trail.length);
    const g=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,r);
    g.addColorStop(0,`rgba(0,255,247,${a})`); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(pt.x,pt.y,r,0,Math.PI*2); ctx.fill();
  });
  if(p.dashForce>0){
    ctx.beginPath(); ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x-p.dashDx*45,p.y-p.dashDy*45);
    ctx.strokeStyle='#00fff738'; ctx.lineWidth=10; ctx.stroke();
  }
  if(p.invFrames>0&&~~(p.invFrames/4)%2===0) return;
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
  const pulse=.5+.5*Math.sin(t*.2);
  const grd=ctx.createRadialGradient(0,0,0,0,0,22);
  grd.addColorStop(0,'#00fff720'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
  ctx.shadowColor='#00fff7'; ctx.shadowBlur=12+pulse*8;
  ctx.fillStyle='#00fff7';
  ctx.beginPath(); ctx.moveTo(13,0); ctx.lineTo(-9,9); ctx.lineTo(-6,0); ctx.lineTo(-9,-9); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#00aaaa';
  ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-9,6); ctx.lineTo(-7,0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-9,-6); ctx.lineTo(-7,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#fff'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.arc(-1,0,3,0,Math.PI*2); ctx.fill();
  ctx.restore();
  if(p.shield>0){
    const sr=22+2*Math.sin(t*.12);
    ctx.beginPath(); ctx.arc(p.x,p.y,sr,0,Math.PI*2);
    ctx.strokeStyle=`rgba(0,136,255,${.3+.2*Math.sin(t*.18)})`; ctx.lineWidth=2+p.shield/Math.max(p.maxShield,1); ctx.stroke();
  }
}

// ─ ENEMIES ───────────────────────────
function drawEnemies() {
  game.enemies.forEach(e=>{
    ctx.save(); ctx.translate(e.x,e.y);
    const pulse=.5+.5*Math.sin(game.t*.15+e.wobble);
    const grd=ctx.createRadialGradient(0,0,0,0,0,e.sz*3);
    grd.addColorStop(0,e.col+(e.elite?'40':'25')); grd.addColorStop(1,'transparent');
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,e.sz*3,0,Math.PI*2); ctx.fill();
    ctx.shadowColor=e.col; ctx.shadowBlur=e.flashTimer>0?28:(8+pulse*6);
    ctx.fillStyle=e.flashTimer>0?'#fff':e.col;
    if(e.ghost) ctx.globalAlpha=.55+.25*Math.sin(game.t*.12+e.wobble);
    const s=e.sz;
    drawShape(e,s);
    // Elite ring
    if(e.elite){
      ctx.globalAlpha=1;
      ctx.save(); ctx.rotate(game.t*.04);
      ctx.strokeStyle=e.col+'88'; ctx.lineWidth=1.5;
      ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(0,0,s*1.9,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    ctx.globalAlpha=1; ctx.restore();
    // HP bar
    if(e.hp<e.maxHp){
      const bw=e.sz*3,bh=3,bx=e.x-bw/2,by=e.y-e.sz-10;
      ctx.fillStyle='#22001188'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle=e.col; ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),bh);
    }
    // State indicator (small dot)
    const stateColors={chase:'#ff003c',flank:'#ffee00',retreat:'#0088ff',ambush:'#cc00ff',patrol:'#444466'};
    ctx.beginPath(); ctx.arc(e.x,e.y-e.sz-15,3,0,Math.PI*2);
    ctx.fillStyle=stateColors[e.state]||'#666'; ctx.fill();
  });
}

function drawShape(e,s) {
  switch(e.shape){
    case 'tri': ctx.rotate(e.angle+Math.PI/2);
      ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s*.85,s*.75); ctx.lineTo(-s*.85,s*.75); ctx.closePath(); ctx.fill(); break;
    case 'dia': ctx.rotate(e.wobble*.3);
      ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0); ctx.closePath(); ctx.fill(); break;
    case 'hex':
      ctx.beginPath(); for(let i=0;i<6;i++){const a=i*Math.PI/3;i===0?ctx.moveTo(Math.cos(a)*s,Math.sin(a)*s):ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s);}
      ctx.closePath(); ctx.fill(); break;
    case 'arr': ctx.rotate(e.angle);
      ctx.beginPath(); ctx.moveTo(s*1.7,0); ctx.lineTo(-s,s*.7); ctx.lineTo(-s*.4,0); ctx.lineTo(-s,-s*.7); ctx.closePath(); ctx.fill(); break;
    case 'crs': ctx.rotate(e.wobble*.5);
      for(let i=0;i<4;i++){ctx.fillRect(-s*.28,-s*1.15,s*.56,s*2.3);ctx.rotate(Math.PI/2);} break;
    case 'sq': ctx.rotate(e.wobble*.2);
      ctx.fillRect(-s,-s,s*2,s*2); break;
  }
}

// ─ BOSS ──────────────────────────────
function drawBoss() {
  const b=game.boss, t=game.t;
  ctx.save(); ctx.translate(b.x,b.y);
  const pulse=.5+.5*Math.sin(t*.08);
  const s=b.sz;
  const grd=ctx.createRadialGradient(0,0,0,0,0,s*4.5);
  grd.addColorStop(0,b.col+(b.phase===2?'50':'28')); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,s*4.5,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.rotate(t*.04); ctx.strokeStyle=b.col+(b.phase===2?'aa':'66');
  ctx.lineWidth=2; ctx.setLineDash([9,9]);
  ctx.beginPath(); ctx.arc(0,0,s*2,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  ctx.shadowColor=b.col; ctx.shadowBlur=b.flashTimer>0?45:(18+pulse*18);
  ctx.fillStyle=b.flashTimer>0?'#fff':b.col;
  ctx.rotate(b.wobble*.06);
  ctx.beginPath();
  for(let i=0;i<8;i++){const a=i*(Math.PI/4),r2=s*(i%2===0?1:.68);i===0?ctx.moveTo(Math.cos(a)*r2,Math.sin(a)*r2):ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);}
  ctx.closePath(); ctx.fill();
  ctx.fillStyle=b.phase===2?'#fff':'#ffffff88'; ctx.shadowBlur=22;
  ctx.beginPath(); ctx.arc(0,0,s*.38,0,Math.PI*2); ctx.fill();
  if(b.phase===2){
    ctx.strokeStyle=b.col+'cc'; ctx.lineWidth=3;
    ctx.save(); ctx.rotate(-t*.06);
    ctx.beginPath(); ctx.arc(0,0,s*1.5,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

// ─ BULLETS ───────────────────────────
function drawBullets() {
  game.bullets.forEach(b=>{
    b.trail.forEach((pt,i)=>{const a=.38*(1-i/b.trail.length);
      const h=(~~(a*255)).toString(16).padStart(2,'0');
      ctx.beginPath(); ctx.arc(pt.x,pt.y,b.r*.5*(1-i/b.trail.length),0,Math.PI*2);
      ctx.fillStyle=b.col+h; ctx.fill();});
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fillStyle=b.col; ctx.shadowColor=b.col; ctx.shadowBlur=14; ctx.fill(); ctx.shadowBlur=0;
  });
}
function drawEBullets() {
  game.eBullets.forEach(b=>{
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fillStyle=b.col+'dd'; ctx.shadowColor=b.col; ctx.shadowBlur=9; ctx.fill(); ctx.shadowBlur=0;
  });
}

// ─ PARTICLES ─────────────────────────
function drawParticles() {
  game.particles.forEach(pt=>{
    const a=pt.life/pt.maxLife, h=(~~(a*255)).toString(16).padStart(2,'0');
    ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r*a,0,Math.PI*2);
    ctx.fillStyle=pt.col+h; ctx.fill();
  });
}

// ─ PICKUPS ───────────────────────────
function drawPickups() {
  const cols={hp:'#ff44aa',xp:'#44ffaa',shield:'#44aaff',wep:'#ffee00'};
  const icons={hp:'♥',xp:'◈',shield:'⬡',wep:'★'};
  game.pickups.forEach(pk=>{
    const sc=1+.2*Math.sin(pk.pulse*2), c=cols[pk.type]||'#fff';
    ctx.save(); ctx.translate(pk.x,pk.y); ctx.scale(sc,sc);
    ctx.fillStyle=c; ctx.shadowColor=c; ctx.shadowBlur=20;
    ctx.font='bold 14px Share Tech Mono'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(icons[pk.type]||'?',0,0); ctx.restore();
    const pr=13+7*Math.sin(pk.pulse);
    ctx.beginPath(); ctx.arc(pk.x,pk.y,pr,0,Math.PI*2);
    ctx.strokeStyle=c+'40'; ctx.lineWidth=1; ctx.stroke();
  });
}

// ─ FLOATING TEXT ─────────────────────
function drawFloats() {
  game.floats.forEach(ft=>{
    const a=ft.life/ft.maxLife;
    ctx.globalAlpha=a; ctx.fillStyle=ft.col; ctx.shadowColor=ft.col; ctx.shadowBlur=7;
    ctx.font=`bold 10px 'Orbitron',monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(ft.text,ft.x,ft.y); ctx.globalAlpha=1; ctx.shadowBlur=0;
  });
}

// ─ MINIMAP ───────────────────────────
function drawMinimap() {
  const mw=85,mh=85,scX=mw/MAP_W,scY=mh/MAP_H;
  mm.clearRect(0,0,mw,mh); mm.fillStyle='#00000c'; mm.fillRect(0,0,mw,mh);
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++)
    if(game.map[y][x]===0){mm.fillStyle='#0d0030';mm.fillRect(x*scX,y*scY,scX,scY);}
  // Arenas
  game.arenas.forEach(a=>{if(!a.cleared){mm.fillStyle='#ffee0033';mm.fillRect(a.x*scX,a.y*scY,a.w*scX,a.h*scY);}});
  game.enemies.forEach(e=>{mm.fillStyle=e.col+(e.elite?'ff':'88');mm.fillRect(e.x/TILE*scX-1,e.y/TILE*scY-1,e.elite?3:2,e.elite?3:2);});
  if(game.bossActive&&game.boss?.alive){const b=game.boss;mm.fillStyle=b.col;mm.beginPath();mm.arc(b.x/TILE*scX,b.y/TILE*scY,5,0,Math.PI*2);mm.fill();}
  const p=game.player;
  mm.fillStyle='#00fff7'; mm.beginPath(); mm.arc(p.x/TILE*scX,p.y/TILE*scY,3,0,Math.PI*2); mm.fill();
  mm.strokeStyle='#00fff744'; mm.lineWidth=1; mm.beginPath(); mm.arc(p.x/TILE*scX,p.y/TILE*scY,5,0,Math.PI*2); mm.stroke();
}

// ═══════════════════════════════════════
//  GAME OVER
// ═══════════════════════════════════════
function endGame() {
  game.running=false;
  if(game.score>highScore.score) highScore.score=game.score;
  if(game.wave>highScore.wave)   highScore.wave=game.wave;
  if(game.kills>highScore.kills) highScore.kills=game.kills;
  saveHS(); updateHSDisplay();
  document.getElementById('go-stats').innerHTML=`
    <div class="gl">SCORE</div><div class="gv ${game.score>=highScore.score?'gbest':''}">${String(game.score).padStart(6,'0')}</div>
    <div class="gl">WAVE</div><div class="gv">${game.wave}</div>
    <div class="gl">KILLS</div><div class="gv">${game.kills}</div>
    <div class="gl">LEVEL</div><div class="gv">${game.player.level}</div>
    <div class="gl">DMG DEALT</div><div class="gv">${game.player.totalDmgDealt}</div>
    <div class="gl">WEAPON</div><div class="gv">${game.currentWep}</div>`;
  showScreen('gameover-screen');
}

// ═══════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════
function loop() {
  update();
  if(game.running||game.betweenWaves) draw();
  requestAnimationFrame(loop);
}

// ═══════════════════════════════════════
//  START
// ═══════════════════════════════════════
function startGame() {
  resizeCanvas(); initInput(); initGame();
  const {map,rooms,arenas}=generateMap();
  game.map=map; game.rooms=rooms; game.arenas=arenas;
  game.setWep=setWep;
  walkable=buildWalkable(map);
  const sr=rooms[0];
  game.player=mkPlayer(sr.cx*TILE+TILE/2, sr.cy*TILE+TILE/2);
  game.camera.x=game.player.x-canvas.width/2;
  game.camera.y=game.player.y-canvas.height/2;
  game.running=true;
  setWep('PULSE');
  document.getElementById('buff-row').innerHTML='';
  hideScreen('title-screen'); hideScreen('gameover-screen');
  hideScreen('upgrade-screen'); hideScreen('pause-screen'); hideScreen('boss-screen'); hideScreen('arena-screen');
  document.getElementById('game-wrapper').style.display='flex';
  document.getElementById('boss-hud').classList.add('hidden');
  document.getElementById('arena-indicator').classList.add('hidden');
  requestAnimationFrame(()=>{resizeCanvas();game.camera.x=game.player.x-canvas.width/2;game.camera.y=game.player.y-canvas.height/2;startWave();});
}

// ═══════════════════════════════════════
//  SCREEN HELPERS
// ═══════════════════════════════════════
function showScreen(id){const el=document.getElementById(id);el.style.display='flex';el.classList.add('active');}
function hideScreen(id){const el=document.getElementById(id);el.style.display='none';el.classList.remove('active');}
function togglePause(){if(!game.running)return;game.paused=!game.paused;game.paused?showScreen('pause-screen'):hideScreen('pause-screen');}

// ═══════════════════════════════════════
//  JOYSTICK SETUP
// ═══════════════════════════════════════
function setupJoy(zoneId, knobId, onMove) {
  const zone=document.getElementById(zoneId), knob=document.getElementById(knobId);
  const R=55; let tid=null;
  const ctr=()=>{const r=zone.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};};
  const apply=(tx,ty)=>{const c=ctr();let dx=tx-c.x,dy=ty-c.y,d=Math.hypot(dx,dy);if(d>R){dx=dx/d*R;dy=dy/d*R;}knob.style.transform=`translate(${dx}px,${dy}px)`;onMove(dx/R,dy/R,true);};
  const reset=()=>{tid=null;knob.style.transform='translate(0,0)';onMove(0,0,false);zone.classList.remove('active');};
  zone.addEventListener('touchstart',e=>{e.preventDefault();if(tid!==null)return;tid=e.changedTouches[0].identifier;zone.classList.add('active');apply(e.changedTouches[0].clientX,e.changedTouches[0].clientY);},{passive:false});
  document.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===tid){apply(t.clientX,t.clientY);break;}},{passive:false});
  document.addEventListener('touchend',e=>{for(const t of e.changedTouches)if(t.identifier===tid){reset();break;}});
  document.addEventListener('touchcancel',e=>{for(const t of e.changedTouches)if(t.identifier===tid){reset();break;}});
}

setupJoy('move-zone','move-knob',(x,y)=>{if(input){input.move.x=x;input.move.y=y;}});
setupJoy('fire-zone','fire-knob',(x,y,a)=>{if(input){input.fire.x=x;input.fire.y=y;input.fire.active=a;}});

// ═══════════════════════════════════════
//  INPUT EVENTS
// ═══════════════════════════════════════
document.addEventListener('keydown',e=>{if(!input)return;input.keys[e.key]=true;if(e.key==='Escape'||e.key==='p')togglePause();if(e.key==='Shift')input.dash=true;});
document.addEventListener('keyup',e=>{if(input)input.keys[e.key]=false;});
canvas.addEventListener('mousemove',e=>{if(!game?.player||!game.running)return;const r=canvas.getBoundingClientRect();game.player.angle=Math.atan2(e.clientY-r.top-(game.player.y-game.camera.y),e.clientX-r.left-(game.player.x-game.camera.x));});
canvas.addEventListener('mousedown',()=>{if(input)input.fire.active=true;});
canvas.addEventListener('mouseup',()=>{if(input)input.fire.active=false;});
document.getElementById('start-btn').addEventListener('click',startGame);
document.getElementById('retry-btn').addEventListener('click',startGame);
document.getElementById('menu-btn').addEventListener('click',()=>{hideScreen('gameover-screen');document.getElementById('game-wrapper').style.display='none';showScreen('title-screen');});
document.getElementById('pause-btn').addEventListener('click',togglePause);
document.getElementById('resume-btn').addEventListener('click',togglePause);
document.getElementById('quit-btn').addEventListener('click',()=>{hideScreen('pause-screen');document.getElementById('game-wrapper').style.display='none';game.running=false;showScreen('title-screen');});
document.getElementById('dash-btn').addEventListener('touchstart',e=>{e.preventDefault();if(input)input.dash=true;},{passive:false});
document.getElementById('dash-btn').addEventListener('mousedown',()=>{if(input)input.dash=true;});

// ═══════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════
initInput(); initGame();
game.map=Array.from({length:MAP_H},()=>Array(MAP_W).fill(0));
game.rooms=[{cx:20,cy:20,x:15,y:15,w:10,h:10}];
game.arenas=[];
loop();
