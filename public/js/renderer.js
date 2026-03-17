/**
 * renderer.js – Port de Display.cpp para LlamaGochi Web
 *
 * Renderiza el juego en un Canvas HTML5 de 240×320px.
 * Usa sprites PNG cargados de /sprites/*.png
 */

'use strict';

const SCREEN_W = 240;
const SCREEN_H = 320;

// Colores de especie (mismos valores RGB que speciesColor() en Sprites.h)
const SPECIES_COLORS = {
  0: '#f74000',  // FIRE → naranja-rojo
  1: '#0820f8',  // WATER → azul
  2: '#00fc00',  // PLANT → verde
  3: '#ffe000',  // ELECTRIC → amarillo
};

const STAGE_SPRITES = [
  '/sprites/llama_egg.png',
  '/sprites/llama_baby.png',
  '/sprites/llama_child.png',
  '/sprites/llama_teen.png',
  '/sprites/llama_adult.png',
  '/sprites/llama_elder.png',
];

const WEATHER_ICONS = [
  '/sprites/icon_sun.png',
  '/sprites/icon_cloud.png',
  '/sprites/icon_cold.png',
  '/sprites/icon_hot.png',
  '/sprites/icon_rain.png',
];

// Paleta de colores de la pantalla
const C = {
  bg:        '#0a1628',
  bg2:       '#0d1e38',
  text:      '#c0e0c0',
  textDim:   '#406040',
  white:     '#ffffff',
  green:     '#00ff00',
  yellow:    '#ffff00',
  red:       '#ff4040',
  orange:    '#ff8800',
  blue:      '#4488ff',
  darkGreen: '#006000',
  barBg:     '#1a2a1a',
  menuHl:    '#204020',
  menuBorder:'#40a040',
};

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.sprites     = {};
    this.weatherIcons = {};
    this._loadSprites();

    this._animFrame  = 0;
    this._animTimer  = setInterval(() => { this._animFrame = (this._animFrame + 1) % 4; }, 400);

    // Fuente pixel disponible (cargada por CSS)
    this._fontReady = false;
    document.fonts.ready.then(() => { this._fontReady = true; });
  }

  destroy() { clearInterval(this._animTimer); }

  _loadSprites() {
    STAGE_SPRITES.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      this.sprites[i] = img;
    });
    WEATHER_ICONS.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      this.weatherIcons[i] = img;
    });
  }

  // ─── Render principal ────────────────────────────────────────────────

  render(pet, screen, menuState) {
    const ctx = this.ctx;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    if (screen === 'HOUSE')    this._renderHouse(pet);
    else if (screen === 'MENU') this._renderMenu(pet, menuState);
    else if (screen === 'SHOP') this._renderShop(pet, menuState);
    else if (screen === 'INVENTORY') this._renderInventory(pet, menuState);
    else if (screen === 'EVOLUTION') this._renderEvolution(pet);
  }

  // ─── Pantalla principal: casa ────────────────────────────────────────

  _renderHouse(pet) {
    const ctx = this.ctx;

    // Fondo de la habitación
    this._drawBackground(pet.house.wallpaper, pet.house.floor);

    // Stats en la parte superior
    this._drawStatBars(pet);

    // Ícono de clima (simulado por hora del día)
    const hour = new Date().getHours();
    const weatherIdx = hour < 6 || hour > 20 ? 1 : hour > 14 && hour < 18 ? 0 : 0;
    const weatherImg = this.weatherIcons[weatherIdx];
    if (weatherImg?.complete) ctx.drawImage(weatherImg, 220, 4, 16, 16);

    // Muebles
    this._drawFurniture(pet.house);

    // Sprite del pet (con animación de salto)
    const petY = 160 + (this._animFrame < 2 ? 0 : -4);
    this._drawPetSprite(pet, 104, petY);

    // Estado: dormido
    if (pet.is_sleeping) {
      ctx.fillStyle = C.blue;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('zzz...', 140, 155);
    }

    // Nombre del pet
    this._drawText(pet.name, 4, SCREEN_H - 16, C.textDim, 6);

    // Alerta si hay stat crítico
    const crit = this._getCriticalStat(pet);
    if (crit) {
      ctx.fillStyle = (this._animFrame % 2 === 0) ? '#ff0000' : '#880000';
      ctx.fillRect(0, 0, SCREEN_W, 3);
      this._drawText(`! ${crit.toUpperCase()} BAJO !`, 40, SCREEN_H - 4, '#ff4040', 5);
    }

    // Instrucciones
    this._drawText('[A] Acción  [B] Menú', 4, SCREEN_H - 4, C.textDim, 5);
  }

  _drawBackground(wallpaper, floor) {
    const ctx = this.ctx;
    // Colores de fondo según wallpaper
    const wallColors = ['#1a2a4a','#2a1a3a','#1a3a2a','#3a2a1a'];
    ctx.fillStyle = wallColors[wallpaper % wallColors.length];
    ctx.fillRect(0, 20, SCREEN_W, SCREEN_H - 60);

    // Piso
    const floorColors = ['#3a2a10','#2a3a1a','#3a3a3a','#1a2a3a'];
    ctx.fillStyle = floorColors[floor % floorColors.length];
    ctx.fillRect(0, SCREEN_H - 60, SCREEN_W, 60);

    // Línea separadora suelo/pared
    ctx.fillStyle = '#604020';
    ctx.fillRect(0, SCREEN_H - 62, SCREEN_W, 3);
  }

  _drawStatBars(pet) {
    const ctx = this.ctx;
    ctx.fillStyle = C.bg2;
    ctx.fillRect(0, 0, SCREEN_W, 20);

    const stats = [
      { label:'♥', val: pet.health,    color:'#ff4040' },
      { label:'★', val: pet.happiness, color:'#ffff00' },
      { label:'●', val: pet.hunger,    color:'#88ff44' },
      { label:'⚡', val: pet.energy,   color:'#44aaff' },
    ];
    const barW = 40;
    stats.forEach((s, i) => {
      const x = 4 + i * 60;
      // Label
      ctx.fillStyle = s.color;
      ctx.font = '8px monospace';
      ctx.fillText(s.label, x, 13);
      // Fondo barra
      ctx.fillStyle = C.barBg;
      ctx.fillRect(x + 10, 5, barW, 8);
      // Barra
      const fill = Math.round(s.val / 100 * barW);
      ctx.fillStyle = s.val < 20 ? '#ff2020' : s.val < 50 ? '#ffaa00' : s.color;
      ctx.fillRect(x + 10, 5, fill, 8);
      // Borde
      ctx.strokeStyle = C.textDim;
      ctx.strokeRect(x + 10, 5, barW, 8);
    });
  }

  _drawFurniture(house) {
    const ctx = this.ctx;
    const furnitureIcons = { '-1': null, 13:'🛏', 14:'🛏', 15:'🛋', 16:'📺', 17:'🌿' };
    if (house.furniture_l >= 0) {
      ctx.font = '20px serif';
      ctx.fillText(furnitureIcons[house.furniture_l] || '□', 20, SCREEN_H - 40);
    }
    if (house.furniture_r >= 0) {
      ctx.font = '20px serif';
      ctx.fillText(furnitureIcons[house.furniture_r] || '□', SCREEN_W - 40, SCREEN_H - 40);
    }
  }

  _drawPetSprite(pet, x, y) {
    const ctx = this.ctx;
    const img = this.sprites[pet.stage];
    if (!img?.complete || img.naturalWidth === 0) {
      // Fallback: rectángulo de color mientras carga
      ctx.fillStyle = SPECIES_COLORS[pet.species] || '#ffffff';
      ctx.fillRect(x, y, 32, 32);
      return;
    }

    // Dibujar sprite con tint de especie usando offscreen canvas
    const tintColor = SPECIES_COLORS[pet.species];
    const offscreen = document.createElement('canvas');
    offscreen.width  = 32;
    offscreen.height = 32;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(img, 0, 0, 32, 32);

    // Reemplazar píxeles de cuerpo (gris claro ~EEEE) con color de especie
    const imageData = offCtx.getImageData(0, 0, 32, 32);
    const data = imageData.data;
    const [tr, tg, tb] = this._hexToRgb(tintColor);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      // EEEE en RGB565 ≈ RGB888 (238,238,238)
      if (r >= 225 && g >= 225 && b >= 225 && r < 245 && data[i+3] > 0) {
        data[i]   = tr;
        data[i+1] = tg;
        data[i+2] = tb;
      }
      // Magenta → transparente
      if (r > 230 && g < 20 && b > 230) data[i+3] = 0;
    }
    offCtx.putImageData(imageData, 0, 0);

    // Accesorios del guardarropa (emoji simple)
    const acc = { 9:'🎩', 10:'🕶', 11:'🦸', 12:'✨' };
    if (pet.wardrobe.hat >= 0 && acc[pet.wardrobe.hat]) {
      ctx.font = '12px serif';
      ctx.fillText(acc[pet.wardrobe.hat], x + 8, y - 2);
    }

    ctx.drawImage(offscreen, x, y, 32, 32);
  }

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return [r, g, b];
  }

  // ─── Pantalla de menú ────────────────────────────────────────────────

  _renderMenu(pet, menuState) {
    const ctx = this.ctx;
    const MENU_ITEMS = ['Alimentar','Jugar','Dormir','Curar','Tienda','Casa','Inventario','Compendio'];

    ctx.fillStyle = C.bg2;
    ctx.fillRect(10, 10, SCREEN_W - 20, SCREEN_H - 20);
    ctx.strokeStyle = C.menuBorder;
    ctx.strokeRect(10, 10, SCREEN_W - 20, SCREEN_H - 20);

    this._drawText('MENÚ', SCREEN_W/2 - 16, 30, C.green, 8);

    MENU_ITEMS.forEach((item, i) => {
      const y = 50 + i * 30;
      const selected = menuState.selected === i;
      if (selected) {
        ctx.fillStyle = C.menuHl;
        ctx.fillRect(14, y - 12, SCREEN_W - 28, 22);
        ctx.strokeStyle = C.menuBorder;
        ctx.strokeRect(14, y - 12, SCREEN_W - 28, 22);
      }
      this._drawText((selected ? '> ' : '  ') + item, 24, y, selected ? C.white : C.text, 7);
    });

    this._drawText('[C/D] Mover  [A] OK  [B] Volver', 14, SCREEN_H - 16, C.textDim, 5);
  }

  // ─── Tienda ──────────────────────────────────────────────────────────

  _renderShop(pet, menuState) {
    const ctx = this.ctx;
    ctx.fillStyle = C.bg2;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.strokeStyle = C.orange;
    ctx.strokeRect(4, 4, SCREEN_W - 8, SCREEN_H - 8);

    this._drawText('TIENDA', SCREEN_W/2 - 22, 22, C.orange, 8);
    this._drawText(`Monedas: ${pet.coins}c`, 10, 38, C.yellow, 6);

    const shopItems = ITEM_CATALOG.slice(0, 9);
    shopItems.forEach((item, i) => {
      const y = 55 + i * 28;
      const selected = menuState.selected === i;
      if (selected) {
        ctx.fillStyle = '#2a1a00';
        ctx.fillRect(6, y - 12, SCREEN_W - 12, 24);
      }
      const priceColor = pet.coins >= SHOP_PRICES[i] ? C.green : '#ff4040';
      this._drawText((selected ? '>' : ' ') + item.name, 12, y, selected ? C.white : C.text, 6);
      this._drawText(`${SHOP_PRICES[i]}c`, SCREEN_W - 36, y, priceColor, 6);
    });

    this._drawText('[A] Comprar  [B] Volver', 14, SCREEN_H - 10, C.textDim, 5);
  }

  // ─── Inventario ──────────────────────────────────────────────────────

  _renderInventory(pet, menuState) {
    const ctx = this.ctx;
    ctx.fillStyle = C.bg2;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.strokeStyle = C.blue;
    ctx.strokeRect(4, 4, SCREEN_W - 8, SCREEN_H - 8);

    this._drawText('INVENTARIO', SCREEN_W/2 - 36, 22, C.blue, 8);

    if (pet.inventory.length === 0) {
      this._drawText('Inventario vacío', 40, SCREEN_H/2, C.textDim, 7);
    } else {
      pet.inventory.forEach((entry, i) => {
        const item = ITEM_CATALOG.find(it => it.id === entry.id);
        if (!item) return;
        const y = 45 + i * 26;
        const selected = menuState.selected === i;
        if (selected) {
          ctx.fillStyle = '#001a2a';
          ctx.fillRect(6, y - 10, SCREEN_W - 12, 22);
        }
        this._drawText(`${item.name} x${entry.qty}`, 14, y, selected ? C.white : C.text, 6);
      });
    }

    this._drawText('[A] Usar  [B] Volver', 14, SCREEN_H - 10, C.textDim, 5);
  }

  // ─── Pantalla de evolución ───────────────────────────────────────────

  _renderEvolution(pet) {
    const ctx = this.ctx;
    const stageNames = ['Huevo','Bebé','Cría','Adolescente','Adulta','Anciana'];
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Efecto de destello
    if (this._animFrame % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,100,0.1)';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }

    this._drawText('¡EVOLUCIÓN!', SCREEN_W/2 - 42, 60, C.yellow, 8);
    this._drawPetSprite(pet, SCREEN_W/2 - 16, 100);
    this._drawText(pet.name, SCREEN_W/2 - 20, 150, C.white, 7);
    this._drawText(`ahora es ${stageNames[pet.stage]}`, 20, 175, C.green, 6);
    if (pet.evolution_key) {
      this._drawText(`Tipo: ${pet.evolution_key}`, 20, 200, C.textDim, 5);
    }
    this._drawText('[A] Continuar', 50, SCREEN_H - 20, C.textDim, 6);
  }

  // ─── Utilidades ──────────────────────────────────────────────────────

  _drawText(text, x, y, color, size) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    ctx.fillText(text, x, y);
  }

  _getCriticalStat(pet) {
    if (pet.hunger    < 20) return 'hambre';
    if (pet.happiness < 20) return 'felicidad';
    if (pet.health    < 20) return 'salud';
    if (pet.energy    < 20) return 'energía';
    return null;
  }
}
