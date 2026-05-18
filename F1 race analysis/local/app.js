// ========== F1 RACE SIMULATION ENGINE ==========

const TIRE_SPECS = {
  S: { muMod: -0.4, degRate: 0.045, cliff: 6, color: '#ef4444' },
  M: { muMod: 0.0, degRate: 0.020, cliff: 12, color: '#eab308' },
  H: { muMod: 0.5, degRate: 0.008, cliff: 20, color: '#d1d5db' }
};

const DRIVER_META = {
  Verstappen: { abbr:'VER', team:'Red Bull',      color:'#3671C6' },
  Perez:      { abbr:'PER', team:'Red Bull',      color:'#3671C6' },
  Hamilton:   { abbr:'HAM', team:'Mercedes',      color:'#27F4D2' },
  Russell:    { abbr:'RUS', team:'Mercedes',      color:'#27F4D2' },
  Leclerc:    { abbr:'LEC', team:'Ferrari',       color:'#E8002D' },
  Sainz:      { abbr:'SAI', team:'Ferrari',       color:'#E8002D' },
  Norris:     { abbr:'NOR', team:'McLaren',       color:'#FF8000' },
  Piastri:    { abbr:'PIA', team:'McLaren',       color:'#FF8000' },
  Alonso:     { abbr:'ALO', team:'Aston Martin',  color:'#229971' },
  Stroll:     { abbr:'STR', team:'Aston Martin',  color:'#229971' },
  Gasly:      { abbr:'GAS', team:'Alpine',        color:'#FF87BC' },
  Ocon:       { abbr:'OCO', team:'Alpine',        color:'#FF87BC' },
  Tsunoda:    { abbr:'TSU', team:'RB',            color:'#6692FF' },
  Ricciardo:  { abbr:'RIC', team:'RB',            color:'#6692FF' },
  Hulkenberg: { abbr:'HUL', team:'Haas',          color:'#B6BABD' },
  Magnussen:  { abbr:'MAG', team:'Haas',          color:'#B6BABD' },
  Albon:      { abbr:'ALB', team:'Williams',      color:'#64C4FF' },
  Bottas:     { abbr:'BOT', team:'Sauber',        color:'#52E252' },
  Zhou:       { abbr:'ZHO', team:'Sauber',        color:'#52E252' },
  Sargeant:   { abbr:'SAR', team:'Williams',      color:'#64C4FF' }
};

// ========== TRACK GENERATION ==========
function catmullRom(p0, p1, p2, p3, steps = 20) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps, t2 = t * t, t3 = t2 * t;
    const x = 0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
    const y = 0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
    pts.push([x, y]);
  }
  return pts;
}

function generateTrack(cx, cy, scale = 1) {
  // Hourglass shape matching user's drawing
  const raw = [
    [-300, -150], // 0: Start/Finish (Left edge)
    [-150, -300], // 1: Top edge
    [-50, -250],  // 2: Top right edge (Pit Entry area)
    [-30, -100],  // 3: Neck dipping inwards
    [80, -20],    // 4: Bottom lobe entry (Pit Exit area)
    [200, 0],     // 5: Bottom lobe top
    [300, 150],   // 6: Far right
    [250, 300],   // 7: Bottom right
    [50, 350],    // 8: Bottom
    [-100, 250],  // 9: Bottom left
    [-150, 100],  // 10: Left neck
    [-250, 0],    // 11: Bottom left of top lobe
  ];
  
  // Rotate by -45 degrees (tilt left) to make it landscape
  const theta = -Math.PI / 4;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rotated = raw.map(([x, y]) => [
    x * cos - y * sin,
    x * sin + y * cos
  ]);

  const ctrl = rotated.map(([x, y]) => [x * scale + cx, y * scale + cy]);
  const n = ctrl.length;
  const track = [];
  for (let i = 0; i < n; i++) {
    const seg = catmullRom(ctrl[(i - 1 + n) % n], ctrl[i], ctrl[(i + 1) % n], ctrl[(i + 2) % n], 20);
    track.push(...seg);
  }
  return track;
}

function computeNormals(track) {
  const n = track.length;
  return track.map((_, i) => {
    const dx = track[(i + 1) % n][0] - track[(i - 1 + n) % n][0];
    const dy = track[(i + 1) % n][1] - track[(i - 1 + n) % n][1];
    const ln = Math.sqrt(dx * dx + dy * dy) || 1;
    return [-dy / ln, dx / ln];
  });
}

function computeAngles(track) {
  const n = track.length;
  return track.map((_, i) => {
    const dx = track[(i + 1) % n][0] - track[i][0];
    const dy = track[(i + 1) % n][1] - track[i][1];
    return Math.atan2(dy, dx);
  });
}

// ========== DRIVER CLASS ==========
class Driver {
  constructor(name, mu, sigma, expectedRaceTime, winProb, trackLen, strategy) {
    this.name = name;
    this.meta = DRIVER_META[name] || { abbr: name.slice(0, 3).toUpperCase(), team: '?', color: '#888' };
    this.baseMu = mu; this.baseSigma = sigma;
    this.expectedRaceTime = expectedRaceTime; this.winProb = winProb;
    this.trackLen = trackLen; this.strategy = strategy || [];
    this.reset();
  }

  reset() {
    this.totalTime = 0; this.lap = 0; this.trackPos = 0; this.finished = false;
    this.finishTime = 0; this.speed = 0; this.pitting = false; this.pitTimer = 0;
    this.tireAge = 0; this.nextPitIdx = 0; this.inPitLane = false;
    this.tire = 'M';
    if (this.strategy.length > 0) {
      const first = this.strategy[0];
      if (typeof first === 'string') { this.tire = first; this.nextPitIdx = 1; }
      else if (Array.isArray(first) && first[0] === 0) { this.tire = first[1]; this.nextPitIdx = 1; }
    }
  }

  getCurrentMu() {
    const s = TIRE_SPECS[this.tire];
    let mu = this.baseMu + s.muMod;
    let deg = this.tireAge * s.degRate;
    if (this.tireAge > s.cliff) deg += (this.tireAge - s.cliff) * 0.1;
    return mu + deg;
  }

  getTireLife() {
    const cliff = TIRE_SPECS[this.tire].cliff;
    return Math.max(0, 100 - (this.tireAge / cliff) * 100);
  }

  update(numLaps, refTime) {
    if (this.finished) return;
    this.totalTime += 1 / 60;
    const baseSpd = this.trackLen / (12 * 60);

    // Pit entry decision
    const approachIdx = this.pitEntryIdx - 10;
    if (this.trackPos > approachIdx && this.trackPos < this.pitEntryIdx && this.nextPitIdx < this.strategy.length) {
      const pit = this.strategy[this.nextPitIdx];
      if (Array.isArray(pit) && this.lap === pit[0]) {
        this.pitting = true;
        this.inPitLane = true;
        this.pitTimer = 2.5;
        this.tire = pit[1];
        this.nextPitIdx++;
      }
    }

    if (this.inPitLane) {
      this.speed = baseSpd * 0.45;
      const midPoint = this.pitEntryIdx + (this.pitExitIdx - this.pitEntryIdx) / 2;
      
      if (this.trackPos >= midPoint - 1 && this.trackPos <= midPoint + 1 && this.pitTimer > 0) {
        this.speed = 0;
        this.pitTimer -= 1 / 60;
        if (this.pitTimer <= 0) {
          this.tireAge = 0;
          this.pitting = false;
        }
      }
      this.trackPos += this.speed;
      if (this.trackPos >= this.pitExitIdx) {
        this.inPitLane = false;
        this.trackPos = this.pitExitIdx;
      }
      return;
    }

    const curMu = this.getCurrentMu();
    const ratio = refTime / this.expectedRaceTime;
    const tireRatio = this.baseMu / curMu;
    const noise = 1 + (Math.random() - 0.5) * 0.02;
    const target = baseSpd * Math.pow(ratio, 20) * Math.pow(tireRatio, 5) * noise;
    this.speed = this.speed * 0.92 + target * 0.08;
    this.trackPos += this.speed;

    if (this.trackPos >= this.trackLen) {
      this.trackPos -= this.trackLen;
      this.lap++;
      this.tireAge++;
    }

    if (this.lap >= numLaps) { this.finished = true; this.finishTime = this.totalTime; this.trackPos = 0; }
  }
}

// ========== MAIN APP ==========
class RaceApp {
  constructor() {
    this.canvas = document.getElementById('track-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.drivers = [];
    this.raceFinished = false;
    this.numLaps = 15;
    this.stats = {};
    this.config = {};
    this.track = []; this.normals = []; this.angles = [];
    this.trackSurface = null;
    this.started = false;
  }

  async init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => { this.resizeCanvas(); this.buildTrack(); });

    const resp = await fetch('data/drivers.json');
    this.data = await resp.json();
    this.stats = this.data.stats || {};
    this.config = this.data.config || {};
    this.numLaps = this.config.num_laps || 15;

    this.buildTrack();
    this.renderStats();
    this.renderConfig();
    this.startSequence();
  }

  resizeCanvas() {
    const area = document.getElementById('track-area');
    this.canvas.width = area.clientWidth * devicePixelRatio;
    this.canvas.height = area.clientHeight * devicePixelRatio;
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    this.cw = area.clientWidth;
    this.ch = area.clientHeight;
  }

  buildTrack() {
    this.scale = Math.min(this.cw/800, this.ch/600) * 0.95;
    this.track = generateTrack(this.cw / 2, this.ch / 2, this.scale);
    this.normals = computeNormals(this.track);
    this.angles = computeAngles(this.track);
    this.preRenderTrack();
  }

  preRenderTrack() {
    const off = document.createElement('canvas');
    off.width = this.canvas.width; off.height = this.canvas.height;
    const c = off.getContext('2d');
    c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const hw = 40;
    const t = this.track, nm = this.normals, n = t.length;

    // Road surface
    c.beginPath();
    for (let i = 0; i < n; i++) { const x = t[i][0]+nm[i][0]*hw, y = t[i][1]+nm[i][1]*hw; i?c.lineTo(x,y):c.moveTo(x,y); }
    for (let i = n-1; i >= 0; i--) { const x = t[i][0]-nm[i][0]*hw, y = t[i][1]-nm[i][1]*hw; c.lineTo(x,y); }
    c.closePath();
    c.fillStyle = '#1a1a2e'; c.fill();

    // Edge lines
    c.beginPath();
    for (let i = 0; i <= n; i++) { const j=i%n, x=t[j][0]+nm[j][0]*hw, y=t[j][1]+nm[j][1]*hw; i?c.lineTo(x,y):c.moveTo(x,y); }
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.stroke();
    c.beginPath();
    for (let i = 0; i <= n; i++) { const j=i%n, x=t[j][0]-nm[j][0]*hw, y=t[j][1]-nm[j][1]*hw; i?c.lineTo(x,y):c.moveTo(x,y); }
    c.stroke();

    // Center dashes
    c.setLineDash([8, 12]); c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i <= n; i++) { const j=i%n; i?c.lineTo(t[j][0],t[j][1]):c.moveTo(t[j][0],t[j][1]); }
    c.stroke(); c.setLineDash([]);

    // Generate Explicit Pit Lane (Straight line shortcut)
    this.pitEntryIdx = 45; // After index 2
    this.pitExitIdx = 75;  // Before index 4
    this.pitTrack = [];
    const pE = t[this.pitEntryIdx];
    const pX = t[this.pitExitIdx];
    
    const steps = this.pitExitIdx - this.pitEntryIdx;
    for (let i = 0; i <= steps; i++) {
        const p = i / steps;
        const x = pE[0] + (pX[0] - pE[0]) * p;
        const y = pE[1] + (pX[1] - pE[1]) * p;
        this.pitTrack.push([x, y]);
    }

    // Draw Pit Lane (gray road)
    c.beginPath();
    for (let i = 0; i < this.pitTrack.length; i++) {
        const pt = this.pitTrack[i];
        if (i === 0) c.moveTo(pt[0], pt[1]);
        else c.lineTo(pt[0], pt[1]);
    }
    c.strokeStyle = '#555'; c.lineWidth = 15; c.stroke();

    // Start/finish line
    const p = t[0], nm0 = nm[0];
    c.beginPath();
    c.moveTo(p[0]+nm0[0]*hw, p[1]+nm0[1]*hw);
    c.lineTo(p[0]-nm0[0]*hw, p[1]-nm0[1]*hw);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();

    // Label
    c.font = '11px Inter'; c.fillStyle = 'rgba(255,255,255,0.15)'; c.textAlign = 'center';
    c.fillText('SILVERSTONE CIRCUIT', this.cw/2, this.ch - 20);

    this.trackSurface = off;
  }

  createDrivers() {
    this.drivers = [];
    const dd = this.data.drivers;
    const refTime = Math.min(...Object.values(dd).map(v => v.expected_race_time));
    this.refTime = refTime;
    for (const [name, v] of Object.entries(dd)) {
      const d = new Driver(name, v.mu, v.sigma, v.expected_race_time, v.win_probability, this.track.length, v.strategy);
      d.pitEntryIdx = this.pitEntryIdx;
      d.pitExitIdx = this.pitExitIdx;
      this.drivers.push(d);
    }
  }

  getCarPos(trackPos, laneIdx, inPitLane) {
    if (inPitLane && this.pitTrack) {
        let pitPos = trackPos - this.pitEntryIdx;
        if (pitPos < 0) pitPos = 0;
        if (pitPos >= this.pitTrack.length) pitPos = this.pitTrack.length - 1;
        const pt = this.pitTrack[Math.floor(pitPos)];
        return [pt[0], pt[1]]; 
    }
    
    const idx = Math.floor(trackPos) % this.track.length;
    const pt = this.track[idx], nm = this.normals[idx];
    const laneW = 3.5;
    const offset = (laneIdx - 9.5) * laneW;
    return [pt[0] + nm[0] * offset, pt[1] + nm[1] * offset];
  }

  drawCar(x, y, angle, color, abbr, isPitting, isLeader) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(angle);

    // Glow for leader
    if (isLeader) {
      c.shadowColor = color; c.shadowBlur = 12;
    }

    // Car body
    c.beginPath();
    c.moveTo(10, 0); c.lineTo(3, -3.5); c.lineTo(-8, -2.5);
    c.lineTo(-10, -4); c.lineTo(-10, 4); c.lineTo(-8, 2.5);
    c.lineTo(3, 3.5); c.closePath();

    c.fillStyle = isPitting ? '#555' : color;
    c.fill();
    c.strokeStyle = isPitting ? '#eab308' : 'rgba(255,255,255,0.6)';
    c.lineWidth = 0.8; c.stroke();
    c.shadowBlur = 0;

    c.restore();

    // Label above car
    c.font = 'bold 8px JetBrains Mono'; c.textAlign = 'center';
    c.fillStyle = isPitting ? '#eab308' : '#fff';
    c.fillText(abbr, x, y - 10);
  }

  sortDrivers() {
    this.drivers.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1; if (b.finished) return 1;
      if (a.lap !== b.lap) return b.lap - a.lap;
      return b.trackPos - a.trackPos;
    });
  }

  updateUI() {
    const wrap = document.getElementById('standings-list');
    const lapEl = document.getElementById('lap-counter');
    const maxLap = this.drivers.length ? Math.max(...this.drivers.map(d => d.lap)) : 0;
    lapEl.textContent = `LAP ${Math.min(maxLap + 1, this.numLaps)} / ${this.numLaps}`;

    let html = '';
    const leader = this.drivers[0];
    this.drivers.forEach((d, i) => {
      const m = d.meta;
      const life = d.getTireLife();
      const tireSpec = TIRE_SPECS[d.tire];
      const lifeColor = life > 50 ? 'var(--green)' : life > 20 ? 'var(--yellow)' : 'var(--red)';
      let gapText = '';
      if (i === 0) gapText = 'LEADER';
      else if (d.finished && leader.finished) gapText = '+' + (d.finishTime - leader.finishTime).toFixed(1) + 's';
      else if (!d.finished && !leader.finished) {
        const lapDiff = leader.lap - d.lap;
        if (lapDiff > 0) gapText = '+' + lapDiff + ' LAP';
        else gapText = '+' + ((leader.trackPos - d.trackPos) / (this.track.length / 90)).toFixed(1) + 's';
      }
      if (d.finished && i === 0) gapText = 'P1 🏁';

      html += `<div class="driver-row${d.pitting?' pitting':''}">
        <span class="pos">${i+1}</span>
        <span class="team-bar" style="background:${m.color}"></span>
        <div class="driver-info">
          <div class="driver-abbr">${m.abbr}</div>
          <div class="driver-name">${d.name}</div>
        </div>
        <div class="tire-badge" style="background:${tireSpec.color}">${d.tire}</div>
        <div class="tire-bar-wrap"><div class="tire-bar" style="width:${life}%;background:${lifeColor}"></div></div>
        <span class="gap-text">${d.pitting?'<span class="pit-label">PIT</span>':gapText}</span>
      </div>`;
    });
    wrap.innerHTML = html;
  }

  renderStats() {
    const el = document.getElementById('stats-content');
    const s = this.stats;
    if (!s.elite_benchmark) { el.innerHTML = '<p class="stat-line">No stats available</p>'; return; }

    let html = '';

    // Field average
    html += `<div class="stat-card"><h3>PODIUM CONTENDER BENCHMARK</h3>
      <p class="stat-line">Top 5 Avg Pace: <strong>${s.elite_benchmark.toFixed(1)}s</strong></p></div>`;

    // 1-Sample T-Tests
    const dvf = s.driver_vs_field || {};
    const contenders = [];
    for (const [n, d] of Object.entries(dvf)) {
      if (d.status === 'Podium Contender') contenders.push((DRIVER_META[n]||{}).abbr || n.slice(0,3));
    }
    html += `<div class="stat-card"><h3>MIDFIELD PODIUM CONTENDERS</h3>
      <p class="stat-line">1-Sample T-Test against Top 5 Benchmark.</p>
      <p class="stat-line">Statistically fast enough to fight for podium:</p>
      <p class="stat-line"><span class="good">${contenders.join(', ') || 'None'}</span></p></div>`;

    // Teammate Battles
    const h2h = s.head_to_head || [];
    const h2hLines = h2h.map(h => {
      const w = (DRIVER_META[h.winner]||{}).abbr || h.winner.slice(0,3);
      const l = (DRIVER_META[h.loser]||{}).abbr || h.loser.slice(0,3);
      const p = h.p_value < 0.001 ? 'P<0.001' : `P=${h.p_value.toFixed(3)}`;
      return `<p class="stat-line">${w} > ${l} (${p})</p>`;
    }).join('');
    html += `<div class="stat-card"><h3>TEAMMATE BATTLES (2-SAMPLE T-TEST)</h3>
      <p class="stat-line">Proves which driver is the clear Number 1.</p>
      ${h2hLines||'<p class="stat-line">No clear dominance.</p>'}</div>`;

    // Chi-square
    if (s.chi_square) {
      const cs = s.chi_square;
      const p = cs.p_value < 0.001 ? 'P<0.001' : `P=${cs.p_value.toFixed(3)}`;
      const fits = !cs.significant;
      html += `<div class="stat-card"><h3>PHYSICS QA (CHI-SQUARE TEST)</h3>
        <p class="stat-line">Validates if random lap generation is realistic.</p>
        <p class="stat-line">${cs.target}: χ²=${cs.chi_stat.toFixed(3)} ${p}</p>
        <p class="stat-line">Simulation physics: <span class="${fits?'good':'bad'}">${fits?'100% MATHEMATICALLY VALID':'DEVIATES'}</span></p></div>`;
    }

    // ANOVA - Strategy
    if (s.anova_strategy) {
      const av = s.anova_strategy;
      const p = av.p_value < 0.001 ? 'P<0.001' : `P=${av.p_value.toFixed(3)}`;
      html += `<div class="stat-card"><h3>STRATEGY OPTIMIZATION (ANOVA)</h3>
        <p class="stat-line">Tests variance between 1-stop and 2-stop strategies.</p>
        <p class="stat-line">F-Stat=${av.f_stat.toFixed(2)} ${p}</p>
        <p class="stat-line">Strategy Impact: <span class="${av.significant?'good':'bad'}">${av.significant?'SIGNIFICANT EFFECT':'NO CLEAR ADVANTAGE'}</span></p></div>`;
    }
    el.innerHTML = html;
  }

  renderConfig() {
    document.getElementById('config-bar').innerHTML =
      `<span>SIMS: ${this.config.sim_runs||500}</span><span>LAPS: ${this.numLaps}</span><span>DRIVERS: ${Object.keys(this.data.drivers).length}</span><span>DIST: LOG-NORMAL</span>`;
  }

  async startSequence() {
    const overlay = document.getElementById('start-overlay');
    const lights = document.querySelectorAll('.light');
    const txt = document.getElementById('start-text');
    overlay.classList.remove('hidden');

    // Light sequence
    for (let i = 0; i < 5; i++) {
      await this.delay(600);
      lights[i].classList.add('on');
    }
    await this.delay(800 + Math.random() * 1500);

    // Lights out
    lights.forEach(l => { l.classList.remove('on'); l.classList.add('green'); });
    txt.classList.add('show');
    txt.textContent = 'LIGHTS OUT AND AWAY WE GO!';
    await this.delay(1500);
    overlay.classList.add('hidden');

    this.createDrivers();
    this.started = true;
    this.raceFinished = false;
    this.gameLoop();
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  gameLoop() {
    if (!this.started) return;

    if (!this.raceFinished) {
      for (const d of this.drivers) d.update(this.numLaps, this.refTime);
      this.sortDrivers();
      if (this.drivers.every(d => d.finished)) {
        this.raceFinished = true;
        this.showFinish();
      }
    }

    // Draw
    const c = this.ctx;
    c.clearRect(0, 0, this.cw, this.ch);
    if (this.trackSurface) c.drawImage(this.trackSurface, 0, 0, this.cw, this.ch);

    for (let i = this.drivers.length - 1; i >= 0; i--) {
      const d = this.drivers[i];
      const pos = d.finished ? 0 : d.trackPos;
      const [x, y] = this.getCarPos(pos, i, d.inPitLane);
      const angle = this.angles[Math.floor(pos) % this.track.length];
      this.drawCar(x, y, angle, d.meta.color, d.meta.abbr, d.pitting, i === 0);
    }

    this.updateUI();
    requestAnimationFrame(() => this.gameLoop());
  }

  showFinish() {
    const overlay = document.getElementById('finish-overlay');
    const winner = this.drivers[0];
    document.getElementById('winner-name').textContent = `${winner.meta.abbr} — ${winner.name}`;
    overlay.classList.remove('hidden');
  }

  replay() {
    document.getElementById('finish-overlay').classList.add('hidden');
    this.started = false;
    this.raceFinished = false;
    this.startSequence();
  }
}

// ========== LAUNCH ==========
const app = new RaceApp();
document.addEventListener('DOMContentLoaded', () => app.init());
document.getElementById('replay-btn')?.addEventListener('click', () => app.replay());
