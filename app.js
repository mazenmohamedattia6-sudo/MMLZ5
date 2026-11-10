// ══════════ الجولات (عدّل الكلام هنا) ══════════
const ROUNDS = [
  { icon: '😊', text: 'ضحكتك لوحدها بتصلح يومي كله.' },
  { icon: '🛡️', text: 'إنتِ مصدر أماني ومصدر طمأنتي.' },
  { icon: '🍷', text: 'عيونك شبه الخمرة…\nكل ما أبص فيها أدوخ أكتر.' },
  { icon: '🤍', text: 'حضنك أحلى مكان بروحله.\nبرتاح فيه وبنسى الدنيا.' },
  { icon: '💗', final: true, text: 'لقيتيني كل مرة…\nلأني دايماً مستخبي في نفس المكان:\nجنبك. 💗\n\n— مازن، أبو ليلي 🌙' },
];
const TOTAL = ROUNDS.length;

// ══════════ دوال صافية (اتختبرت) ══════════
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// r = المسافة ÷ قطر الأرينا
function heatLevel(r) {
  if (r < 0.08) return { k: 5, label: 'ولّعت! 🌋' };
  if (r < 0.16) return { k: 4, label: 'سخن أوي 🔥🔥' };
  if (r < 0.26) return { k: 3, label: 'سخن 🔥' };
  if (r < 0.38) return { k: 2, label: 'دافي 🙂' };
  if (r < 0.52) return { k: 1, label: 'بارد ❄️' };
  return { k: 0, label: 'ثلج 🥶' };
}
const heatT = r => clamp(1 - r / 0.6, 0, 1);                       // 0 = ثلج .. 1 = ولّعت
const foundRadius = (W, H) => Math.max(28, 0.07 * Math.min(W, H));

// مكان جديد للقلب: بعيد عن الحواف وعن المكان القديم
function placeHeart(W, H, prev, rnd) {
  const mx = W * 0.12, my = H * 0.14, minSep = Math.min(W, H) * 0.45;
  for (let i = 0; i < 200; i++) {
    const p = { x: mx + rnd() * (W - 2 * mx), y: my + rnd() * (H - 2 * my) };
    if (!prev || dist(p.x, p.y, prev.x, prev.y) >= minSep) return p;
  }
  return { x: W - mx, y: H - my };
}

function hintText(px, py, hx, hy, W, H) {
  const dx = hx - px, dy = hy - py, tx = W * 0.06, ty = H * 0.06, parts = [];
  if (dy < -ty) parts.push('فوق'); else if (dy > ty) parts.push('تحت');
  if (dx > tx) parts.push('يمين'); else if (dx < -tx) parts.push('شمال');
  return parts.length ? 'جرّبي ناحية: ' + parts.join(' و') : 'إنتِ جنبه أوي!';
}

// ══════════ العناصر ══════════
const $ = id => document.getElementById(id);
const arena = $('arena'), cv = $('game'), ctx = cv.getContext('2d'), root = document.documentElement;
const roundEl = $('round'), attEl = $('attempts'), bestEl = $('best');
const fillEl = $('thermo-fill'), tempEl = $('temp'), trendEl = $('trend'), hintEl = $('arena-hint');
const noteEl = $('note'), hintBtn = $('btn-hint'), nextBtn = $('btn-next'), sndBtn = $('snd');
const revealEl = $('reveal'), rvIcon = $('rv-icon'), rvText = $('rv-text'), rvSub = $('rv-sub');

function load(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ══════════ الحالة ══════════
let W = 0, H = 0, dpr = 1, D = 1;
let heart = null, prevHeart = null;
let round = 0, attempts = 0, totalAttempts = 0, state = 'playing';     // playing | found | done
let ptr = null, down = false, prevD = null, digs = [], hintUntil = 0, hintUsed = false, foundAt = 0;
let best = load('malak_hotcold_best', null), clock = 0, tickT = 0;
if (best !== null) bestEl.textContent = best;

function fit() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = arena.getBoundingClientRect();
  const ow = W, oh = H;
  W = r.width || 400; H = r.height || 440; D = Math.hypot(W, H);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (heart && ow && oh) { heart = { x: heart.x / ow * W, y: heart.y / oh * H }; digs = digs.map(d => ({ ...d, x: d.x / ow * W, y: d.y / oh * H })); }
}
window.addEventListener('resize', fit);

// ══════════ صوت ══════════
let actx = null, soundOn = true;
function initAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } } if (actx && actx.state === 'suspended') actx.resume(); }
function blip(f, d, type, v, slide) {
  if (!soundOn || !actx) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || .08, t + .005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + .02);
}
sndBtn.addEventListener('click', () => { soundOn = !soundOn; sndBtn.textContent = soundOn ? '🔊' : '🔇'; sndBtn.classList.toggle('off', !soundOn); });

// ══════════ جولة جديدة ══════════
function newRound() {
  prevHeart = heart;
  heart = placeHeart(W, H, prevHeart, Math.random);
  attempts = 0; digs = []; hintUsed = false; hintUntil = 0; ptr = null; prevD = null; state = 'playing';
  attEl.textContent = 0; roundEl.textContent = (round + 1) + '/' + TOTAL;
  revealEl.classList.remove('show'); arena.classList.remove('hot');
  hintBtn.disabled = false; setTemp(null); note('');
  hintEl.classList.remove('off');
}

function setTemp(r) {
  if (r === null) { tempEl.textContent = 'حرّكي إصبعك…'; trendEl.textContent = ''; fillEl.style.width = '2%'; root.style.setProperty('--heat', 215); arena.classList.remove('hot'); return; }
  const lv = heatLevel(r), t = heatT(r);
  tempEl.textContent = lv.label;
  fillEl.style.width = Math.max(2, t * 100) + '%';
  root.style.setProperty('--heat', Math.round(215 - 215 * t));            // أزرق → أحمر
  arena.classList.toggle('hot', lv.k >= 4);
}
function note(t) { noteEl.textContent = t; }

// ══════════ اللمس / الماوس ══════════
function pos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

function track(p) {
  if (state !== 'playing' || !heart) return;
  ptr = p;
  const d = dist(p.x, p.y, heart.x, heart.y);
  setTemp(d / D);
  if (prevD !== null && Math.abs(d - prevD) > 8) { trendEl.textContent = d < prevD ? 'بتسخني 📈' : 'بتبرّدي 📉'; prevD = d; }
  else if (prevD === null) prevD = d;
  hintEl.classList.add('off');
}
cv.addEventListener('pointermove', e => track(pos(e)));
cv.addEventListener('pointerdown', e => { initAudio(); down = true; track(pos(e)); if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} } });
cv.addEventListener('pointerup', e => { const p = pos(e); down = false; dig(p); });
cv.addEventListener('pointerleave', () => { if (!down) ptr = null; });
cv.addEventListener('pointercancel', () => { down = false; });

function dig(p) {
  if (state !== 'playing' || !heart) return;
  attempts += 1; totalAttempts += 1; attEl.textContent = attempts;
  const d = dist(p.x, p.y, heart.x, heart.y);
  if (d <= foundRadius(W, H)) { onFound(); return; }
  const r = d / D;
  digs.push({ x: p.x, y: p.y, t: heatT(r), born: clock });
  setTemp(r); blip(260, 0.12, 'sine', 0.07, 180);
  note(heatLevel(r).k >= 3 ? 'قربتي أوي! 🔥' : '');
}

function onFound() {
  state = 'found'; foundAt = clock; ptr = null;
  const ro = ROUNDS[round];
  setTemp(0); tempEl.textContent = 'لقيتيه! 💗'; fillEl.style.width = '100%'; root.style.setProperty('--heat', 0); arena.classList.add('hot');
  trendEl.textContent = '';
  hintBtn.disabled = true;
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, .25, 'triangle', .1), i * 110));
  celebrate(ro.final ? 30 : 14);

  rvIcon.textContent = ro.icon;
  rvText.textContent = ro.text; rvText.className = 'rv-text' + (ro.final ? ' final' : '');
  const tries = attempts === 1 ? 'من أول محاولة! 🎯' : `لقيتيه في ${attempts} محاولات`;
  if (ro.final) {
    state = 'done';
    if (best === null || totalAttempts < best) { best = totalAttempts; save('malak_hotcold_best', best); bestEl.textContent = best; }
    rvSub.textContent = `كل الجولات الخمسة في ${totalAttempts} محاولة. تحبي تلعبي تاني؟`;
    nextBtn.textContent = 'ابدأي من الأول 🔁';
  } else {
    rvSub.textContent = tries; nextBtn.textContent = 'الجولة الجاية ▶';
  }
  setTimeout(() => { revealEl.classList.add('show'); if (revealEl.scrollIntoView) revealEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 700);
}

nextBtn.addEventListener('click', () => {
  if (state === 'done') { round = 0; totalAttempts = 0; }
  else if (state === 'found') { round += 1; }
  else return;
  newRound();
});

// ══════════ تلميح (مرة واحدة في الجولة) ══════════
hintBtn.addEventListener('click', () => {
  if (state !== 'playing' || hintUsed || !heart) return;
  hintUsed = true; hintBtn.disabled = true;
  const from = ptr || { x: W / 2, y: H / 2 };
  note(hintText(from.x, from.y, heart.x, heart.y, W, H) + ' 🧭');
  hintUntil = clock + 3;
  hintFrom = from;
});
let hintFrom = null;

// ══════════ رسم ══════════
const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + .3, a: Math.random() }));

function draw() {
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a0f24'); bg.addColorStop(1, '#05070f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  stars.forEach(s => { ctx.globalAlpha = .15 + .3 * Math.abs(Math.sin(clock * .5 + s.a * 9)); ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1;

  // علامات المحاولات الغلط
  digs.forEach(d => {
    const hue = 215 - 215 * d.t;
    ctx.beginPath(); ctx.arc(d.x, d.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},85%,60%,.28)`; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = `hsla(${hue},90%,68%,.9)`; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x - 4, d.y - 4); ctx.lineTo(d.x + 4, d.y + 4); ctx.moveTo(d.x + 4, d.y - 4); ctx.lineTo(d.x - 4, d.y + 4); ctx.stroke();
  });

  // سخونة حوالين الإصبع
  if (ptr && state === 'playing' && heart) {
    const t = heatT(dist(ptr.x, ptr.y, heart.x, heart.y) / D), hue = 215 - 215 * t;
    const g = ctx.createRadialGradient(ptr.x, ptr.y, 4, ptr.x, ptr.y, 70 + t * 110);
    g.addColorStop(0, `hsla(${hue},95%,62%,${.25 + t * .45})`); g.addColorStop(1, `hsla(${hue},95%,62%,0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 70 + t * 110, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 15 + t * 6, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = `hsla(${hue},95%,72%,.95)`; ctx.stroke();
  }

  // سهم التلميح
  if (hintFrom && clock < hintUntil && heart && state === 'playing') {
    const a = Math.atan2(heart.y - hintFrom.y, heart.x - hintFrom.x), pulse = 1 + Math.sin(clock * 8) * .1;
    ctx.save(); ctx.translate(hintFrom.x, hintFrom.y); ctx.rotate(a); ctx.globalAlpha = Math.min(1, (hintUntil - clock));
    ctx.fillStyle = '#e8d08a'; ctx.beginPath(); ctx.moveTo(70 * pulse, 0); ctx.lineTo(44, -14); ctx.lineTo(44, 14); ctx.closePath(); ctx.fill();
    ctx.fillRect(18, -3, 28, 6); ctx.restore(); ctx.globalAlpha = 1;
  }

  // القلب لما يتلاقي
  if ((state === 'found' || state === 'done') && heart) {
    const k = Math.min(1, (clock - foundAt) / 0.5), s = (1 + Math.sin(clock * 5) * .06) * (0.3 + 0.7 * (1 - Math.pow(1 - k, 3)));
    const g = ctx.createRadialGradient(heart.x, heart.y, 0, heart.x, heart.y, 110);
    g.addColorStop(0, 'rgba(255,120,150,.6)'); g.addColorStop(1, 'rgba(255,120,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(heart.x, heart.y, 110, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(heart.x, heart.y); ctx.scale(s, s);
    ctx.font = '72px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(255,100,150,.9)'; ctx.shadowBlur = 24;
    ctx.fillText('💗', 0, 0); ctx.restore();
  }
}

// ══════════ حلقة التحديث (وطقطقة جايجر بتسرع كل ما تقرب) ══════════
let last = 0;
function frame(ts) {
  const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016; last = ts; clock += dt;
  if (state === 'playing' && ptr && heart) {
    const t = heatT(dist(ptr.x, ptr.y, heart.x, heart.y) / D);
    if (t > 0.3) { tickT += dt; const interval = 0.75 - t * 0.65; if (tickT >= interval) { tickT = 0; blip(700 + t * 900, 0.03, 'square', 0.035); } }
  }
  draw(); requestAnimationFrame(frame);
}

// ══════════ تأثيرات + خلفية ══════════
function celebrate(n) {
  const s = ['💗', '🔥', '✨', '🌙', '💌'];
  for (let k = 0; k < n; k++) {
    setTimeout(() => {
      const h = document.createElement('div'); h.className = 'float-p';
      h.textContent = s[Math.floor(Math.random() * s.length)];
      h.style.cssText += `left:${10 + Math.random() * 80}vw;font-size:${.8 + Math.random() * 1.1}rem;animation-duration:${2.3 + Math.random() * 2.2}s;`;
      document.body.appendChild(h); setTimeout(() => h.remove(), 5200);
    }, k * 110);
  }
}
const bgC = $('bg-canvas'), bgX = bgC.getContext('2d');
function resizeBg() { bgC.width = innerWidth; bgC.height = innerHeight; }
resizeBg(); window.addEventListener('resize', resizeBg);
const pts = Array.from({ length: 45 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * .7 + .15, vx: (Math.random() - .5) * .1, vy: (Math.random() - .5) * .1, a: Math.random(), da: (Math.random() - .5) * .005, c: Math.random() > .5 ? '201,168,76' : '201,107,138' }));
function drawBg() {
  const w = bgC.width, h = bgC.height; bgX.clearRect(0, 0, w, h);
  pts.forEach(p => {
    p.x += p.vx / w; p.y += p.vy / h; p.a += p.da;
    if (p.a < .05 || p.a > .82) p.da *= -1;
    if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0; if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
    const px = p.x * w, py = p.y * h, g = bgX.createRadialGradient(px, py, 0, px, py, p.r * 6);
    g.addColorStop(0, `rgba(${p.c},${p.a})`); g.addColorStop(1, `rgba(${p.c},0)`);
    bgX.beginPath(); bgX.arc(px, py, p.r * 6, 0, Math.PI * 2); bgX.fillStyle = g; bgX.fill();
  });
  requestAnimationFrame(drawBg);
}
drawBg();

// ══════════ تشغيل ══════════
fit();
newRound();
requestAnimationFrame(frame);
