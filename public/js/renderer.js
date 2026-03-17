/**
 * renderer.js – LlamaGochi 2026
 *
 * Renderiza el juego en Canvas HTML5. Las llamas son SVG vectoriales
 * cute/cartoon generadas inline. Los stats viven en el DOM.
 */

'use strict';

const SCREEN_W = 240;
const SCREEN_H = 260;

// Colores principales por especie
const SPECIES_COLORS = {
  0: '#f97316',  // FIRE → naranja
  1: '#3b82f6',  // WATER → azul
  2: '#22c55e',  // PLANT → verde
  3: '#eab308',  // ELECTRIC → amarillo
};

// Colores de acento (más saturado) por especie
const SPECIES_ACCENT = {
  0: '#ea580c',
  1: '#2563eb',
  2: '#16a34a',
  3: '#ca8a04',
};

// Paleta moderna del canvas
const C = {
  bg:        '#0d1425',
  bgRoom:    '#111827',
  glass:     'rgba(255,255,255,0.05)',
  glassBg:   'rgba(20,30,60,0.7)',
  border:    'rgba(255,255,255,0.10)',
  text:      '#e0e8ff',
  textDim:   'rgba(180,190,230,0.5)',
  white:     '#ffffff',
  accent:    '#a855f7',
  accentBlue:'#6366f1',
  success:   '#22c55e',
  warn:      '#f59e0b',
  danger:    '#ef4444',
};

const STAGE_NAMES = ['Huevo', 'Bebé', 'Cría', 'Teen', 'Adulto', 'Anciana'];

// ─── Speech bubble (DOM) ───────────────────────────────────────────────────

Renderer._dialogTimer = null;

// ─── Clase principal ───────────────────────────────────────────────────────

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this._svgCache  = {};
    this._animFrame = 0;
    this._animTimer = setInterval(() => { this._animFrame = (this._animFrame + 1) % 4; }, 350);

    this._fontReady = false;
    document.fonts.ready.then(() => { this._fontReady = true; });
  }

  destroy() { clearInterval(this._animTimer); }

  // ─── Speech bubble (estática) ────────────────────────────────────────────

  static showDialog(msg, duration = 2800) {
    const el = document.getElementById('speech-bubble');
    if (!el) return;
    document.getElementById('speech-text').textContent = msg;
    el.classList.add('visible');
    clearTimeout(Renderer._dialogTimer);
    Renderer._dialogTimer = setTimeout(() => el.classList.remove('visible'), duration);
  }

  // ─── Actualizar DOM stats ─────────────────────────────────────────────────

  static updateDomStats(pet) {
    const setBar = (id, val) => {
      const bar = document.getElementById(id);
      if (bar) bar.style.width = Math.max(0, Math.min(100, val)) + '%';
    };
    const setPill = (id, critical) => {
      const pill = document.getElementById(id);
      if (pill) pill.classList.toggle('critical', critical);
    };

    setBar('bar-health',    pet.health);
    setBar('bar-happiness', pet.happiness);
    setBar('bar-hunger',    pet.hunger);
    setBar('bar-energy',    pet.energy);

    setPill('stat-health',    pet.health    < 20);
    setPill('stat-happiness', pet.happiness < 20);
    setPill('stat-hunger',    pet.hunger    < 20);
    setPill('stat-energy',    pet.energy    < 20);

    const nameEl = document.getElementById('pet-name-display');
    if (nameEl) nameEl.textContent = pet.name;

    const badgeEl = document.getElementById('pet-stage-badge');
    if (badgeEl) badgeEl.textContent = STAGE_NAMES[pet.stage] || 'Huevo';

    const coinsEl = document.getElementById('coins-amount');
    if (coinsEl) coinsEl.textContent = pet.coins;
  }

  // ─── Render principal ─────────────────────────────────────────────────────

  render(pet, screen, menuState) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    this._drawCanvasBg();

    Renderer.updateDomStats(pet);

    if (screen === 'HOUSE')         this._renderHouse(pet);
    else if (screen === 'MENU')      this._renderMenu(pet, menuState);
    else if (screen === 'SHOP')      this._renderShop(pet, menuState);
    else if (screen === 'INVENTORY') this._renderInventory(pet, menuState);
    else if (screen === 'EVOLUTION') this._renderEvolution(pet);
  }

  _drawCanvasBg() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, '#0d1425');
    g.addColorStop(1, '#111827');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  // ─── Casa ─────────────────────────────────────────────────────────────────

  _renderHouse(pet) {
    const ctx = this.ctx;

    // Fondo de habitación con gradiente moderno
    this._drawRoom(pet.house);

    // Muebles
    this._drawFurniture(pet.house);

    // Sprite del pet (con animación de salto)
    const petY = 100 + (this._animFrame < 2 ? 0 : -5);
    this._drawPetSprite(pet, (SCREEN_W - 96) / 2, petY);

    // Estado dormido
    if (pet.is_sleeping) {
      ctx.font = '16px serif';
      ctx.fillText('💤', (SCREEN_W / 2) + 40, petY + 10);
    }

    // Hints de control (muy discretos)
    this._drawHint('[Z] Acción   [X] Menú', SCREEN_W / 2, SCREEN_H - 8);
  }

  _drawRoom(house) {
    const ctx = this.ctx;

    // Paredes con gradiente
    const wallPalettes = [
      ['#1e2a4a', '#152040'],
      ['#2a1a3e', '#1e1030'],
      ['#1a3a2a', '#0f2a1a'],
      ['#3a2a10', '#281a08'],
    ];
    const [w1, w2] = wallPalettes[house.wallpaper % wallPalettes.length];
    const wallG = ctx.createLinearGradient(0, 0, 0, SCREEN_H - 50);
    wallG.addColorStop(0, w1);
    wallG.addColorStop(1, w2);
    ctx.fillStyle = wallG;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H - 50);

    // Piso con gradiente
    const floorPalettes = [
      ['#3a2a10', '#281e0a'],
      ['#2a3a1a', '#1a2a0e'],
      ['#2a2a2a', '#1a1a1a'],
      ['#1a2a3a', '#0e1a26'],
    ];
    const [f1, f2] = floorPalettes[house.floor % floorPalettes.length];
    const floorG = ctx.createLinearGradient(0, SCREEN_H - 50, 0, SCREEN_H);
    floorG.addColorStop(0, f1);
    floorG.addColorStop(1, f2);
    ctx.fillStyle = floorG;
    ctx.fillRect(0, SCREEN_H - 50, SCREEN_W, 50);

    // Línea del suelo con glow
    ctx.strokeStyle = 'rgba(255,200,100,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, SCREEN_H - 50);
    ctx.lineTo(SCREEN_W, SCREEN_H - 50);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  _drawFurniture(house) {
    const ctx = this.ctx;
    const icons = { 13:'🛏', 14:'🛏', 15:'🛋', 16:'📺', 17:'🌿' };
    if (house.furniture_l >= 0 && icons[house.furniture_l]) {
      ctx.font = '28px serif';
      ctx.fillText(icons[house.furniture_l], 14, SCREEN_H - 18);
    }
    if (house.furniture_r >= 0 && icons[house.furniture_r]) {
      ctx.font = '28px serif';
      ctx.fillText(icons[house.furniture_r], SCREEN_W - 44, SCREEN_H - 18);
    }
  }

  _drawPetSprite(pet, x, y) {
    const ctx  = this.ctx;
    const color  = SPECIES_COLORS[pet.species] || '#a855f7';
    const img  = this._getSvgSprite(pet.stage, color, SPECIES_ACCENT[pet.species] || '#7c3aed');

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, 96, 96);
    } else {
      // Fallback mientras carga el SVG
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 48, y + 48, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Accesorios encima del sprite
    const acc = { 9:'🎩', 10:'🕶', 11:'🦸', 12:'✨' };
    if (pet.wardrobe?.hat >= 0 && acc[pet.wardrobe.hat]) {
      ctx.font = '18px serif';
      ctx.fillText(acc[pet.wardrobe.hat], x + 30, y - 2);
    }
  }

  _drawHint(text, cx, y) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(180,190,230,0.25)';
    ctx.font = '8px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, y);
    ctx.textAlign = 'left';
  }

  // ─── SVG Sprite cache ──────────────────────────────────────────────────────

  _getSvgSprite(stage, color, accent) {
    const key = `${stage}_${color}`;
    if (this._svgCache[key]) return this._svgCache[key];
    const svg = this._buildLlamaSvg(stage, color, accent);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    this._svgCache[key] = img;
    return img;
  }

  _buildLlamaSvg(stage, color, accent) {
    const light = this._lightenHex(color, 0.45);
    const dark  = this._darkenHex(color, 0.3);
    const a     = accent || this._darkenHex(color, 0.2);

    switch (stage) {
      case 0: return this._svgEgg(color, light, dark);
      case 1: return this._svgBaby(color, light, dark, a);
      case 2: return this._svgChild(color, light, dark, a);
      case 3: return this._svgTeen(color, light, dark, a);
      case 4: return this._svgAdult(color, light, dark, a);
      case 5: return this._svgElder(color, light, dark, a);
      default: return this._svgEgg(color, light, dark);
    }
  }

  // ── Stage 0: Huevo ─────────────────────────────────────────────────────────

  _svgEgg(color, light, dark) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <radialGradient id="eg" cx="38%" cy="35%" r="60%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>
    <filter id="sh"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.35"/></filter>
  </defs>
  <ellipse cx="48" cy="56" rx="26" ry="32" fill="url(#eg)" stroke="${dark}" stroke-width="2" filter="url(#sh)"/>
  <ellipse cx="38" cy="46" rx="5" ry="3.5" fill="${color}" opacity="0.45"/>
  <ellipse cx="57" cy="63" rx="4" ry="3" fill="${color}" opacity="0.35"/>
  <ellipse cx="42" cy="68" rx="3" ry="2.5" fill="${color}" opacity="0.3"/>
  <ellipse cx="35" cy="38" rx="4" ry="5" fill="${light}" opacity="0.5" transform="rotate(-15 35 38)"/>
  <!-- Ojos -->
  <circle cx="41" cy="50" r="4" fill="#1a1a2e"/>
  <circle cx="55" cy="50" r="4" fill="#1a1a2e"/>
  <circle cx="42.5" cy="48.5" r="1.5" fill="white"/>
  <circle cx="56.5" cy="48.5" r="1.5" fill="white"/>
  <!-- Sonrisa -->
  <path d="M42 58 Q48 63 54 58" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Rubor -->
  <ellipse cx="37" cy="55" rx="4" ry="2.5" fill="#f9a8d4" opacity="0.55"/>
  <ellipse cx="59" cy="55" rx="4" ry="2.5" fill="#f9a8d4" opacity="0.55"/>
</svg>`;
  }

  // ── Stage 1: Bebé ──────────────────────────────────────────────────────────

  _svgBaby(color, light, dark, accent) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>
    <radialGradient id="hg" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${color}"/>
    </radialGradient>
    <filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.3"/></filter>
  </defs>
  <!-- Cuerpo gordo -->
  <ellipse cx="48" cy="72" rx="20" ry="15" fill="url(#bg)" stroke="${dark}" stroke-width="1.8" filter="url(#sh)"/>
  <!-- Cuello -->
  <rect x="41" y="55" width="14" height="12" rx="6" fill="${color}" stroke="${dark}" stroke-width="1.5"/>
  <!-- Cabeza enorme -->
  <circle cx="48" cy="40" r="22" fill="url(#hg)" stroke="${dark}" stroke-width="1.8" filter="url(#sh)"/>
  <!-- Orejas -->
  <ellipse cx="28" cy="22" rx="6" ry="9" fill="${color}" stroke="${dark}" stroke-width="1.5" transform="rotate(-12 28 22)"/>
  <ellipse cx="68" cy="22" rx="6" ry="9" fill="${color}" stroke="${dark}" stroke-width="1.5" transform="rotate(12 68 22)"/>
  <ellipse cx="28" cy="23" rx="3.5" ry="5.5" fill="#fda4af" opacity="0.7" transform="rotate(-12 28 23)"/>
  <ellipse cx="68" cy="23" rx="3.5" ry="5.5" fill="#fda4af" opacity="0.7" transform="rotate(12 68 23)"/>
  <!-- Ojos enormes (blanco) -->
  <circle cx="39" cy="40" r="9" fill="white" stroke="${dark}" stroke-width="1.2"/>
  <circle cx="57" cy="40" r="9" fill="white" stroke="${dark}" stroke-width="1.2"/>
  <!-- Pupila + iris -->
  <circle cx="40" cy="41" r="6" fill="#1a1a2e"/>
  <circle cx="58" cy="41" r="6" fill="#1a1a2e"/>
  <circle cx="38" cy="39" r="2.5" fill="white"/>
  <circle cx="56" cy="39" r="2.5" fill="white"/>
  <circle cx="41" cy="42" r="1.5" fill="${accent}" opacity="0.6"/>
  <circle cx="59" cy="42" r="1.5" fill="${accent}" opacity="0.6"/>
  <!-- Hocico -->
  <ellipse cx="48" cy="50" rx="8" ry="5.5" fill="#fde68a" stroke="${dark}" stroke-width="1.2"/>
  <circle cx="45" cy="50" r="1.5" fill="${dark}" opacity="0.5"/>
  <circle cx="51" cy="50" r="1.5" fill="${dark}" opacity="0.5"/>
  <path d="M43 54 Q48 57.5 53 54" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <!-- Patas stub -->
  <rect x="28" y="82" width="11" height="11" rx="5" fill="${color}" stroke="${dark}" stroke-width="1.5"/>
  <rect x="57" y="82" width="11" height="11" rx="5" fill="${color}" stroke="${dark}" stroke-width="1.5"/>
  <!-- Rubor -->
  <ellipse cx="30" cy="44" rx="5" ry="3.5" fill="#f9a8d4" opacity="0.6"/>
  <ellipse cx="66" cy="44" rx="5" ry="3.5" fill="#f9a8d4" opacity="0.6"/>
</svg>`;
  }

  // ── Stage 2: Cría ──────────────────────────────────────────────────────────

  _svgChild(color, light, dark, accent) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.3"/></filter>
  </defs>
  <!-- Cuerpo -->
  <ellipse cx="48" cy="68" rx="22" ry="16" fill="url(#cg)" stroke="${dark}" stroke-width="1.8" filter="url(#sh)"/>
  <!-- Cuello fluffy -->
  <ellipse cx="48" cy="52" rx="10" ry="9" fill="${light}" stroke="${dark}" stroke-width="1.5"/>
  <!-- Cabeza -->
  <ellipse cx="48" cy="34" rx="19" ry="17" fill="url(#cg)" stroke="${dark}" stroke-width="1.8" filter="url(#sh)"/>
  <!-- Orejas puntiagudas -->
  <ellipse cx="31" cy="18" rx="5" ry="8" fill="${color}" stroke="${dark}" stroke-width="1.5" transform="rotate(-18 31 18)"/>
  <ellipse cx="65" cy="18" rx="5" ry="8" fill="${color}" stroke="${dark}" stroke-width="1.5" transform="rotate(18 65 18)"/>
  <ellipse cx="31" cy="19" rx="3" ry="5" fill="#fda4af" opacity="0.65" transform="rotate(-18 31 19)"/>
  <ellipse cx="65" cy="19" rx="3" ry="5" fill="#fda4af" opacity="0.65" transform="rotate(18 65 19)"/>
  <!-- Ojos -->
  <circle cx="40" cy="34" r="7.5" fill="white" stroke="${dark}" stroke-width="1.2"/>
  <circle cx="56" cy="34" r="7.5" fill="white" stroke="${dark}" stroke-width="1.2"/>
  <circle cx="41" cy="35" r="5" fill="#1a1a2e"/>
  <circle cx="57" cy="35" r="5" fill="#1a1a2e"/>
  <circle cx="39" cy="33" r="2" fill="white"/>
  <circle cx="55" cy="33" r="2" fill="white"/>
  <circle cx="42" cy="36" r="1.2" fill="${accent}" opacity="0.5"/>
  <circle cx="58" cy="36" r="1.2" fill="${accent}" opacity="0.5"/>
  <!-- Hocico -->
  <ellipse cx="48" cy="43" rx="7" ry="4.5" fill="#fde68a" stroke="${dark}" stroke-width="1.2"/>
  <circle cx="45.5" cy="43" r="1.3" fill="${dark}" opacity="0.4"/>
  <circle cx="50.5" cy="43" r="1.3" fill="${dark}" opacity="0.4"/>
  <path d="M43.5 47 Q48 50 52.5 47" stroke="${dark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <!-- Patas -->
  <rect x="28" y="78" width="12" height="14" rx="5" fill="${color}" stroke="${dark}" stroke-width="1.5"/>
  <rect x="56" y="78" width="12" height="14" rx="5" fill="${color}" stroke="${dark}" stroke-width="1.5"/>
  <!-- Cola -->
  <ellipse cx="72" cy="65" rx="6" ry="8" fill="${light}" stroke="${dark}" stroke-width="1.2" transform="rotate(15 72 65)"/>
  <!-- Rubor -->
  <ellipse cx="31" cy="38" rx="4.5" ry="3" fill="#f9a8d4" opacity="0.55"/>
  <ellipse cx="65" cy="38" rx="4.5" ry="3" fill="#f9a8d4" opacity="0.55"/>
</svg>`;
  }

  // ── Stage 3: Teen ──────────────────────────────────────────────────────────

  _svgTeen(color, light, dark, accent) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="tg" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.3"/></filter>
  </defs>
  <!-- Cuerpo -->
  <ellipse cx="48" cy="70" rx="20" ry="18" fill="url(#tg)" stroke="${dark}" stroke-width="1.8" filter="url(#sh)"/>
  <!-- Cuello largo -->
  <rect x="41" y="44" width="14" height="22" rx="6" fill="${color}" stroke="${dark}" stroke-width="1.5"/>
  <!-- Cabeza -->
  <ellipse cx="48" cy="30" rx="17" ry="15" fill="url(#tg)" stroke="${dark}" stroke-width="1.8" filter="url(#sh)"/>
  <!-- Orejas extra puntiagudas (teen look) -->
  <polygon points="30,22 26,6 36,16" fill="${color}" stroke="${dark}" stroke-width="1.5" stroke-linejoin="round"/>
  <polygon points="66,22 70,6 60,16" fill="${color}" stroke="${dark}" stroke-width="1.5" stroke-linejoin="round"/>
  <polygon points="31,21 28,10 35,17" fill="#fda4af" opacity="0.6"/>
  <polygon points="65,21 68,10 61,17" fill="#fda4af" opacity="0.6"/>
  <!-- Ojos tipo "cool" (un poco entrecerrados) -->
  <ellipse cx="40" cy="30" rx="7" ry="6" fill="white" stroke="${dark}" stroke-width="1.2"/>
  <ellipse cx="56" cy="30" rx="7" ry="6" fill="white" stroke="${dark}" stroke-width="1.2"/>
  <!-- "Cool" — ceja levantada -->
  <path d="M33 24 Q40 22 47 24" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M49 24 Q56 22 63 24" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="40.5" cy="31" rx="4.5" ry="4" fill="#1a1a2e"/>
  <ellipse cx="56.5" cy="31" rx="4.5" ry="4" fill="#1a1a2e"/>
  <circle cx="39" cy="29.5" r="1.8" fill="white"/>
  <circle cx="55" cy="29.5" r="1.8" fill="white"/>
  <circle cx="41.5" cy="31.5" r="1" fill="${accent}" opacity="0.6"/>
  <circle cx="57.5" cy="31.5" r="1" fill="${accent}" opacity="0.6"/>
  <!-- Hocico -->
  <ellipse cx="48" cy="39" rx="6.5" ry="4" fill="#fde68a" stroke="${dark}" stroke-width="1.2"/>
  <circle cx="45.5" cy="39" r="1.2" fill="${dark}" opacity="0.4"/>
  <circle cx="50.5" cy="39" r="1.2" fill="${dark}" opacity="0.4"/>
  <!-- Sonrisa confiada -->
  <path d="M44 43 Q48 46 52 43" stroke="${dark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <!-- Patas -->
  <rect x="25" y="80" width="13" height="14" rx="5" fill="${color}" stroke="${dark}" stroke-width="1.5"/>
  <rect x="58" y="80" width="13" height="14" rx="5" fill="${color}" stroke="${dark}" stroke-width="1.5"/>
  <!-- Detalle pelo -->
  <ellipse cx="48" cy="18" rx="8" ry="5" fill="${light}" stroke="${dark}" stroke-width="1" opacity="0.8"/>
  <!-- Cola -->
  <ellipse cx="70" cy="64" rx="5" ry="9" fill="${light}" stroke="${dark}" stroke-width="1.2" transform="rotate(20 70 64)"/>
</svg>`;
  }

  // ── Stage 4: Adulto ────────────────────────────────────────────────────────

  _svgAdult(color, light, dark, accent) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="ag" x1="10%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <filter id="sh"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.35"/></filter>
  </defs>
  <!-- Cuerpo robusto -->
  <ellipse cx="48" cy="70" rx="24" ry="19" fill="url(#ag)" stroke="${dark}" stroke-width="2" filter="url(#sh)"/>
  <!-- Pecho esponjoso -->
  <ellipse cx="48" cy="60" rx="14" ry="10" fill="${light}" stroke="${dark}" stroke-width="1.2" opacity="0.9"/>
  <!-- Cuello -->
  <rect x="40" y="40" width="16" height="20" rx="7" fill="${color}" stroke="${dark}" stroke-width="1.8"/>
  <!-- Cabeza -->
  <ellipse cx="48" cy="28" rx="19" ry="17" fill="url(#ag)" stroke="${dark}" stroke-width="2" filter="url(#sh)"/>
  <!-- Orejas -->
  <ellipse cx="30" cy="14" rx="6" ry="10" fill="${color}" stroke="${dark}" stroke-width="1.8" transform="rotate(-10 30 14)"/>
  <ellipse cx="66" cy="14" rx="6" ry="10" fill="${color}" stroke="${dark}" stroke-width="1.8" transform="rotate(10 66 14)"/>
  <ellipse cx="30" cy="15" rx="3.5" ry="6.5" fill="#fda4af" opacity="0.65" transform="rotate(-10 30 15)"/>
  <ellipse cx="66" cy="15" rx="3.5" ry="6.5" fill="#fda4af" opacity="0.65" transform="rotate(10 66 15)"/>
  <!-- Ojos expresivos -->
  <circle cx="39" cy="28" r="8.5" fill="white" stroke="${dark}" stroke-width="1.5"/>
  <circle cx="57" cy="28" r="8.5" fill="white" stroke="${dark}" stroke-width="1.5"/>
  <circle cx="40" cy="29" r="5.5" fill="#1a1a2e"/>
  <circle cx="58" cy="29" r="5.5" fill="#1a1a2e"/>
  <circle cx="38" cy="27" r="2.2" fill="white"/>
  <circle cx="56" cy="27" r="2.2" fill="white"/>
  <circle cx="41" cy="30" r="1.3" fill="${accent}" opacity="0.7"/>
  <circle cx="59" cy="30" r="1.3" fill="${accent}" opacity="0.7"/>
  <!-- Hocico -->
  <ellipse cx="48" cy="38" rx="8" ry="5.5" fill="#fde68a" stroke="${dark}" stroke-width="1.5"/>
  <circle cx="45" cy="38" r="1.5" fill="${dark}" opacity="0.45"/>
  <circle cx="51" cy="38" r="1.5" fill="${dark}" opacity="0.45"/>
  <path d="M43 42 Q48 46 53 42" stroke="${dark}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Patas -->
  <rect x="22" y="80" width="14" height="15" rx="6" fill="${color}" stroke="${dark}" stroke-width="1.8"/>
  <rect x="60" y="80" width="14" height="15" rx="6" fill="${color}" stroke="${dark}" stroke-width="1.8"/>
  <!-- Cola esponjosa -->
  <ellipse cx="74" cy="65" rx="7" ry="10" fill="${light}" stroke="${dark}" stroke-width="1.5" transform="rotate(20 74 65)"/>
  <!-- Pelo en cabeza -->
  <ellipse cx="48" cy="12" rx="10" ry="6" fill="${light}" stroke="${dark}" stroke-width="1.2" opacity="0.85"/>
</svg>`;
  }

  // ── Stage 5: Anciana ───────────────────────────────────────────────────────

  _svgElder(color, light, dark, accent) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="elg" x1="10%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <filter id="sh"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.35"/></filter>
  </defs>
  <!-- Cuerpo (igual que adulto) -->
  <ellipse cx="48" cy="70" rx="24" ry="19" fill="url(#elg)" stroke="${dark}" stroke-width="2" filter="url(#sh)"/>
  <ellipse cx="48" cy="60" rx="14" ry="10" fill="white" stroke="${dark}" stroke-width="1.2" opacity="0.8"/>
  <rect x="40" y="40" width="16" height="20" rx="7" fill="${color}" stroke="${dark}" stroke-width="1.8"/>
  <ellipse cx="48" cy="28" rx="19" ry="17" fill="url(#elg)" stroke="${dark}" stroke-width="2" filter="url(#sh)"/>
  <!-- Orejas con pelito blanco en punta -->
  <ellipse cx="30" cy="14" rx="6" ry="10" fill="${color}" stroke="${dark}" stroke-width="1.8" transform="rotate(-10 30 14)"/>
  <ellipse cx="66" cy="14" rx="6" ry="10" fill="${color}" stroke="${dark}" stroke-width="1.8" transform="rotate(10 66 14)"/>
  <ellipse cx="30" cy="15" rx="3.5" ry="6.5" fill="#fda4af" opacity="0.5" transform="rotate(-10 30 15)"/>
  <ellipse cx="66" cy="15" rx="3.5" ry="6.5" fill="#fda4af" opacity="0.5" transform="rotate(10 66 15)"/>
  <ellipse cx="29" cy="7" rx="2.5" ry="3" fill="white" opacity="0.9" transform="rotate(-10 29 7)"/>
  <ellipse cx="67" cy="7" rx="2.5" ry="3" fill="white" opacity="0.9" transform="rotate(10 67 7)"/>
  <!-- Ojos entrecerrados (sabios/amorosos) -->
  <ellipse cx="39" cy="28" rx="8.5" ry="7" fill="white" stroke="${dark}" stroke-width="1.5"/>
  <ellipse cx="57" cy="28" rx="8.5" ry="7" fill="white" stroke="${dark}" stroke-width="1.5"/>
  <!-- Párpados entrecerrados -->
  <path d="M30.5 25 Q39 21 47.5 25" stroke="${dark}" stroke-width="2" fill="${dark}" opacity="0.25"/>
  <path d="M48.5 25 Q57 21 65.5 25" stroke="${dark}" stroke-width="2" fill="${dark}" opacity="0.25"/>
  <ellipse cx="40" cy="29" rx="5.5" ry="4.5" fill="#1a1a2e"/>
  <ellipse cx="58" cy="29" rx="5.5" ry="4.5" fill="#1a1a2e"/>
  <circle cx="38" cy="27.5" r="2" fill="white"/>
  <circle cx="56" cy="27.5" r="2" fill="white"/>
  <!-- Arruguitas de sonrisa -->
  <path d="M31 33 Q34 35 31 37" stroke="${dark}" stroke-width="1.2" fill="none" opacity="0.5"/>
  <path d="M65 33 Q62 35 65 37" stroke="${dark}" stroke-width="1.2" fill="none" opacity="0.5"/>
  <!-- Hocico -->
  <ellipse cx="48" cy="38" rx="8" ry="5.5" fill="#fde68a" stroke="${dark}" stroke-width="1.5"/>
  <circle cx="45" cy="38" r="1.5" fill="${dark}" opacity="0.4"/>
  <circle cx="51" cy="38" r="1.5" fill="${dark}" opacity="0.4"/>
  <path d="M43 42 Q48 46 53 42" stroke="${dark}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Patas -->
  <rect x="22" y="80" width="14" height="15" rx="6" fill="${color}" stroke="${dark}" stroke-width="1.8"/>
  <rect x="60" y="80" width="14" height="15" rx="6" fill="${color}" stroke="${dark}" stroke-width="1.8"/>
  <!-- Cola esponjosa blanca -->
  <ellipse cx="74" cy="65" rx="8" ry="11" fill="white" stroke="${dark}" stroke-width="1.5" transform="rotate(20 74 65)" opacity="0.9"/>
  <!-- Mechones blancos en cabeza -->
  <ellipse cx="48" cy="12" rx="10" ry="6" fill="white" stroke="${dark}" stroke-width="1.2" opacity="0.85"/>
  <ellipse cx="38" cy="11" rx="4" ry="5" fill="white" opacity="0.7" transform="rotate(-20 38 11)"/>
  <ellipse cx="58" cy="11" rx="4" ry="5" fill="white" opacity="0.7" transform="rotate(20 58 11)"/>
</svg>`;
  }

  // ─── Menú ──────────────────────────────────────────────────────────────────

  _renderMenu(pet, menuState) {
    const ctx = this.ctx;
    const MENU_ITEMS = ['Alimentar','Jugar','Dormir','Curar','Tienda','Casa','Inventario','Compendio'];

    // Fondo glass
    this._drawGlassPanel(10, 10, SCREEN_W - 20, SCREEN_H - 20, 14);
    this._drawSectionTitle('MENÚ', SCREEN_W / 2, 38, C.accent);

    MENU_ITEMS.forEach((item, i) => {
      const y = 56 + i * 24;
      const selected = menuState.selected === i;
      if (selected) {
        this._drawGlassPanel(16, y - 14, SCREEN_W - 32, 22, 6, 'rgba(168,85,247,0.2)', 'rgba(168,85,247,0.4)');
      }
      ctx.fillStyle = selected ? C.white : C.text;
      ctx.font = `${selected ? 600 : 400} 11px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText((selected ? '› ' : '  ') + item, 26, y);
    });

    ctx.textAlign = 'left';
    this._drawHint('[Z] OK   [X] Volver   [↑↓] Mover', SCREEN_W / 2, SCREEN_H - 8);
  }

  // ─── Tienda ────────────────────────────────────────────────────────────────

  _renderShop(pet, menuState) {
    const ctx = this.ctx;
    this._drawGlassPanel(6, 6, SCREEN_W - 12, SCREEN_H - 12, 14);
    this._drawSectionTitle('TIENDA', SCREEN_W / 2, 30, '#fbbf24');

    ctx.fillStyle = '#fbbf24';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🪙 ${pet.coins}`, 18, 46);

    const shopItems = ITEM_CATALOG.slice(0, 9);
    shopItems.forEach((item, i) => {
      const y = 62 + i * 21;
      const selected = menuState.selected === i;
      const canAfford = pet.coins >= SHOP_PRICES[i];
      if (selected) {
        this._drawGlassPanel(10, y - 13, SCREEN_W - 20, 20, 5, 'rgba(251,191,36,0.15)', 'rgba(251,191,36,0.35)');
      }
      ctx.fillStyle = selected ? C.white : C.text;
      ctx.font = `${selected ? 600 : 400} 10px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText((selected ? '›' : ' ') + ' ' + item.name, 18, y);
      ctx.fillStyle = canAfford ? C.success : C.danger;
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${SHOP_PRICES[i]}c`, SCREEN_W - 16, y);
    });
    ctx.textAlign = 'left';
    this._drawHint('[Z] Comprar   [X] Volver', SCREEN_W / 2, SCREEN_H - 8);
  }

  // ─── Inventario ────────────────────────────────────────────────────────────

  _renderInventory(pet, menuState) {
    const ctx = this.ctx;
    this._drawGlassPanel(6, 6, SCREEN_W - 12, SCREEN_H - 12, 14);
    this._drawSectionTitle('INVENTARIO', SCREEN_W / 2, 30, C.accentBlue);

    if (pet.inventory.length === 0) {
      ctx.fillStyle = C.textDim;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Inventario vacío', SCREEN_W / 2, SCREEN_H / 2);
      ctx.textAlign = 'left';
    } else {
      pet.inventory.forEach((entry, i) => {
        const item = ITEM_CATALOG.find(it => it.id === entry.id);
        if (!item) return;
        const y = 52 + i * 22;
        const selected = menuState.selected === i;
        if (selected) {
          this._drawGlassPanel(10, y - 13, SCREEN_W - 20, 20, 5, 'rgba(99,102,241,0.15)', 'rgba(99,102,241,0.35)');
        }
        ctx.fillStyle = selected ? C.white : C.text;
        ctx.font = `${selected ? 600 : 400} 10px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText((selected ? '›' : ' ') + ' ' + item.name, 18, y);
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'right';
        ctx.fillText(`x${entry.qty}`, SCREEN_W - 16, y);
      });
    }
    ctx.textAlign = 'left';
    this._drawHint('[Z] Usar   [X] Volver', SCREEN_W / 2, SCREEN_H - 8);
  }

  // ─── Evolución ─────────────────────────────────────────────────────────────

  _renderEvolution(pet) {
    const ctx = this.ctx;

    // Fondo con destello de colores
    const hue = (Date.now() / 30) % 360;
    const g = ctx.createRadialGradient(SCREEN_W/2, SCREEN_H/2, 10, SCREEN_W/2, SCREEN_H/2, 160);
    g.addColorStop(0, `hsla(${hue},80%,20%,0.7)`);
    g.addColorStop(1, 'rgba(10,15,30,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Partículas / estrellitas
    for (let i = 0; i < 8; i++) {
      const t = (Date.now() / 1000 + i * 0.8) % 4;
      const px = 20 + (i * 30) % (SCREEN_W - 40);
      const py = 20 + (t * 60) % (SCREEN_H - 40);
      ctx.fillStyle = `hsla(${(hue + i * 45) % 360},90%,70%,${0.6 - t * 0.1})`;
      ctx.font = '12px serif';
      ctx.fillText('✦', px, py);
    }

    // Título
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('¡EVOLUCIÓN!', SCREEN_W / 2, 50);

    // Sprite
    this._drawPetSprite(pet, (SCREEN_W - 96) / 2, 60);

    // Nombre y stage
    ctx.fillStyle = C.white;
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(pet.name, SCREEN_W / 2, 172);

    const stageNames = ['Huevo','Bebé','Cría','Adolescente','Adulta','Anciana'];
    ctx.fillStyle = C.accent;
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText(`¡Ahora es ${stageNames[pet.stage]}!`, SCREEN_W / 2, 190);

    if (pet.evolution_key) {
      ctx.fillStyle = C.textDim;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`Tipo: ${pet.evolution_key}`, SCREEN_W / 2, 206);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('[Z] Continuar', SCREEN_W / 2, SCREEN_H - 12);
    ctx.textAlign = 'left';
  }

  // ─── Utilidades de dibujo ─────────────────────────────────────────────────

  _drawGlassPanel(x, y, w, h, r, bg, border) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = bg || C.glassBg;
    ctx.fill();
    ctx.strokeStyle = border || C.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  _drawSectionTitle(text, cx, y, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color || C.accent;
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, y);
    ctx.textAlign = 'left';
  }

  // ─── Helpers de color ─────────────────────────────────────────────────────

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return [r, g, b];
  }

  _lightenHex(hex, amount) {
    let [r, g, b] = this._hexToRgb(hex);
    r = Math.min(255, Math.round(r + (255 - r) * amount));
    g = Math.min(255, Math.round(g + (255 - g) * amount));
    b = Math.min(255, Math.round(b + (255 - b) * amount));
    return `rgb(${r},${g},${b})`;
  }

  _darkenHex(hex, amount) {
    let [r, g, b] = this._hexToRgb(hex);
    r = Math.max(0, Math.round(r * (1 - amount)));
    g = Math.max(0, Math.round(g * (1 - amount)));
    b = Math.max(0, Math.round(b * (1 - amount)));
    return `rgb(${r},${g},${b})`;
  }
}
