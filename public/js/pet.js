/**
 * pet.js – Port de Pet.cpp / Pet.h para LlamaGochi Web
 *
 * Clase Pet con toda la lógica de stats, evolución, personalidad.
 * Sin sensores reales: temperatura/luz se simulan.
 */

'use strict';

const SPECIES = { FIRE: 0, WATER: 1, PLANT: 2, ELECTRIC: 3 };
const STAGE   = { EGG: 0, BABY: 1, CHILD: 2, TEEN: 3, ADULT: 4, ELDER: 5 };

// Tiempos de evolución en ms (igual que Pet.cpp)
const EVO_TIMES = [
  86_400_000,   // EGG  → BABY  : 1 día
  259_200_000,  // BABY → CHILD : 3 días
  432_000_000,  // CHILD→ TEEN  : 5 días
  864_000_000,  // TEEN → ADULT : 10 días
  1_728_000_000 // ADULT→ ELDER : 20 días
];

// Catálogo de ítems (mismo orden que GameEngine.cpp)
const ITEM_CATALOG = [
  { id:0,  name:'Hierba',       type:0, hunger:+30, happiness:+5,  health:0,   energy:0   },
  { id:1,  name:'Fruta Mágica', type:0, hunger:+20, happiness:+15, health:+5,  energy:0   },
  { id:2,  name:'Carne Asada',  type:0, hunger:+50, happiness:+10, health:0,   energy:0   },
  { id:3,  name:'Smoothie',     type:0, hunger:+15, happiness:+5,  health:+10, energy:+20 },
  { id:4,  name:'Pelota',       type:1, hunger:0,   happiness:+25, health:0,   energy:-10 },
  { id:5,  name:'Peluche',      type:1, hunger:0,   happiness:+15, health:0,   energy:0   },
  { id:6,  name:'Laberinto',    type:1, hunger:0,   happiness:+20, health:0,   energy:-5  },
  { id:7,  name:'Medicina',     type:2, hunger:0,   happiness:-5,  health:+40, energy:0   },
  { id:8,  name:'Vitaminas',    type:2, hunger:0,   happiness:0,   health:+20, energy:+10 },
  { id:9,  name:'Sombrero',     type:3, rarity:1 },
  { id:10, name:'Gafas de Sol', type:3, rarity:1 },
  { id:11, name:'Capa Real',    type:3, rarity:2 },
  { id:12, name:'Halo Dorado',  type:3, rarity:3 },
  { id:13, name:'Cama Básica',  type:4, energy_bonus:+2 },
  { id:14, name:'Cama Premium', type:4, energy_bonus:+5 },
  { id:15, name:'Sofá',         type:4, happiness_bonus:+3 },
  { id:16, name:'TV',           type:4, happiness_bonus:+2 },
  { id:17, name:'Planta',       type:4, health_bonus:+1   },
];

const SHOP_PRICES = [10,20,30,25, 15,10,20, 40,30, 50,60,120,300, 40,80,60,50,70];

class Pet {
  constructor(data) {
    if (data) {
      Object.assign(this, data);
    } else {
      this._initDefaults();
    }
  }

  _initDefaults() {
    this.name          = 'Llama';
    this.species       = SPECIES.FIRE;
    this.stage         = STAGE.EGG;
    this.hunger        = 80;
    this.happiness     = 80;
    this.health        = 100;
    this.energy        = 80;
    this.coins         = 50;
    this.xp            = 0;
    this.level         = 1;
    this.age_days      = 0;
    this.birth_timestamp  = Date.now();
    this.last_tick        = Date.now();
    this.evolution_key    = '';
    this.is_sleeping      = false;
    this.low_stat_since   = {};   // { stat: timestamp }
    this.is_dead          = false;

    this.personality = {
      curiosity:    this._rand(20, 80),
      appetite:     this._rand(20, 80),
      energy_trait: this._rand(20, 80),
      sociability:  this._rand(20, 80),
      stubbornness: this._rand(20, 80)
    };

    this.wardrobe  = { hat:-1, shirt:-1, pants:-1, shoes:-1, accessory:-1 };
    this.house     = { bed:-1, furniture_l:-1, furniture_r:-1, decor_top:-1, wallpaper:0, floor:0 };
    this.inventory = [];
    this.memories  = [];

    this.care_play_count   = 0;
    this.care_feed_count   = 0;
    this.care_sleep_count  = 0;
    this.games_played_today = 0;
    this.last_game_day     = 0;
  }

  _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  _clamp(v) { return Math.max(0, Math.min(100, v)); }

  // ─── Acciones principales ──────────────────────────────────────────────

  feed(itemId) {
    const item = ITEM_CATALOG.find(i => i.id === itemId);
    if (!item || item.type > 2) return false;
    if (this.is_sleeping) this.wake_up();
    this.hunger    = this._clamp(this.hunger    + (item.hunger    || 0));
    this.happiness = this._clamp(this.happiness + (item.happiness || 0));
    this.health    = this._clamp(this.health    + (item.health    || 0));
    this.energy    = this._clamp(this.energy    + (item.energy    || 0));
    this.care_feed_count++;
    this._removeFromInventory(itemId);
    return true;
  }

  play() {
    if (this.energy < 10) return false;
    if (this.is_sleeping) this.wake_up();
    this.happiness = this._clamp(this.happiness + 20);
    this.energy    = this._clamp(this.energy    - 15);
    this.hunger    = this._clamp(this.hunger    - 5);
    this.care_play_count++;
    this.xp += 5;
    this._checkLevelUp();
    return true;
  }

  sleep_action() {
    if (this.is_sleeping) return false;
    this.is_sleeping = true;
    this.care_sleep_count++;
    return true;
  }

  wake_up() {
    if (!this.is_sleeping) return false;
    this.is_sleeping = false;
    this.energy = this._clamp(this.energy + 30);
    return true;
  }

  heal(itemId) {
    const item = ITEM_CATALOG.find(i => i.id === itemId);
    if (!item || item.type !== 2) return false;
    this.health    = this._clamp(this.health    + (item.health    || 0));
    this.happiness = this._clamp(this.happiness + (item.happiness || 0));
    this.energy    = this._clamp(this.energy    + (item.energy    || 0));
    this._removeFromInventory(itemId);
    return true;
  }

  // ─── Tick (llamado cada 10 minutos) ───────────────────────────────────

  tick() {
    if (this.is_dead) return;

    const now = Date.now();
    const elapsed_ms = now - (this.last_tick || now);
    const ticks = Math.floor(elapsed_ms / (10 * 60 * 1000));
    if (ticks === 0) return;
    this.last_tick = now;

    // Temperatura simulada (varía lentamente durante el día)
    const hour = new Date().getHours();
    let temp = 22 + 6 * Math.sin((hour - 6) * Math.PI / 12);
    let light = (hour >= 7 && hour <= 20) ? 70 : 10;

    for (let t = 0; t < ticks; t++) {
      this._tickOnce(temp, light);
      if (this.is_dead) break;
    }

    this.age_days = Math.floor((now - this.birth_timestamp) / 86_400_000);
    this.checkEvolution();
  }

  _tickOnce(temp, light) {
    if (this.is_sleeping) {
      // Recuperar energía mientras duerme
      this.energy = this._clamp(this.energy + 5);
      if (this.energy >= 100) this.wake_up();
      return;
    }

    // Decaimiento base de stats
    let hungerDecay    = 5;
    let happinessDecay = 3;
    let healthDecay    = 0;
    let energyDecay    = 4;

    // Modificadores de especie
    if (this.species === SPECIES.FIRE)     happinessDecay = Math.round(happinessDecay * 0.7);
    if (this.species === SPECIES.WATER)    healthDecay    = Math.round(healthDecay    * 1.3);
    if (this.species === SPECIES.PLANT)    hungerDecay    = Math.round(hungerDecay    * 0.7);
    if (this.species === SPECIES.ELECTRIC) energyDecay    = Math.round(energyDecay    * 0.7);

    // Efectos de temperatura
    if (temp > 32) { hungerDecay += 5; }
    if (temp < 12) { hungerDecay += 3; energyDecay += 2; }

    // Apagado de noche (luz baja)
    if (light < 20) { this.sleep_action(); }

    // Bonos de mobiliario
    const bed = ITEM_CATALOG.find(i => i.id === this.house.bed && i.type === 4);
    if (bed?.energy_bonus) this.energy = this._clamp(this.energy + bed.energy_bonus);
    if (this.house.furniture_l === 16 || this.house.furniture_r === 16)
      this.happiness = this._clamp(this.happiness + 2);
    if (this.house.furniture_l === 17 || this.house.furniture_r === 17)
      this.health = this._clamp(this.health + 1);

    this.hunger    = this._clamp(this.hunger    - hungerDecay);
    this.happiness = this._clamp(this.happiness - happinessDecay);
    this.health    = this._clamp(this.health    - healthDecay);
    this.energy    = this._clamp(this.energy    - energyDecay);

    // Verificar muerte por negligencia (stat < 10 durante 30 min = 3 ticks)
    const LOW_TICKS = 3;
    const now = Date.now();
    for (const stat of ['hunger', 'happiness', 'health', 'energy']) {
      if (this[stat] < 10) {
        if (!this.low_stat_since[stat]) this.low_stat_since[stat] = now;
        const low_ms = now - this.low_stat_since[stat];
        if (low_ms >= 30 * 60 * 1000) {
          this.is_dead = true;
          return;
        }
      } else {
        delete this.low_stat_since[stat];
      }
    }
  }

  // ─── Evolución ─────────────────────────────────────────────────────────

  checkEvolution() {
    if (this.stage >= STAGE.ELDER) return;
    const age_ms = Date.now() - this.birth_timestamp;
    let threshold = 0;
    for (let s = 0; s <= this.stage; s++) threshold += EVO_TIMES[s];
    if (age_ms >= threshold) {
      this.stage++;
      this.computeEvolutionKey();
      this._addMemory(`Evolución a etapa ${this.stage}`);
    }
  }

  computeEvolutionKey() {
    const speciesNames = ['pyro', 'aqua', 'flora', 'volt'];
    const p = this.personality;
    const traits = [
      ['curious', p.curiosity], ['hungry', p.appetite],
      ['active', p.energy_trait], ['social', p.sociability],
      ['stubborn', p.stubbornness]
    ];
    traits.sort((a, b) => b[1] - a[1]);
    const dominant = traits[0][0];
    const score = this.careScore();
    const path  = score > 0.75 ? 'A' : score > 0.45 ? 'B' : 'C';
    this.evolution_key = `${speciesNames[this.species]}_${dominant}_${path}`;
  }

  careScore() {
    const p = this.personality;
    const playW  = p.curiosity    / 100;
    const feedW  = p.appetite     / 100;
    const sleepW = p.energy_trait / 100;
    const socW   = p.sociability  / 100;
    const total  = playW + feedW + sleepW + socW;
    if (total === 0) return 0;
    const play  = Math.min(this.care_play_count,  50) / 50 * playW;
    const feed  = Math.min(this.care_feed_count,  50) / 50 * feedW;
    const sleep = Math.min(this.care_sleep_count, 20) / 20 * sleepW;
    return (play + feed + sleep) / total;
  }

  // ─── Inventario y tienda ───────────────────────────────────────────────

  buyItem(itemId) {
    const price = SHOP_PRICES[itemId];
    if (price === undefined || this.coins < price) return false;
    this.coins -= price;
    this._addToInventory(itemId);
    return true;
  }

  _addToInventory(itemId) {
    const existing = this.inventory.find(e => e.id === itemId);
    if (existing) existing.qty++;
    else this.inventory.push({ id: itemId, qty: 1 });
  }

  _removeFromInventory(itemId) {
    const idx = this.inventory.findIndex(e => e.id === itemId);
    if (idx === -1) return;
    this.inventory[idx].qty--;
    if (this.inventory[idx].qty <= 0) this.inventory.splice(idx, 1);
  }

  hasItem(itemId) {
    const e = this.inventory.find(e => e.id === itemId);
    return e ? e.qty > 0 : false;
  }

  // ─── Nivel ─────────────────────────────────────────────────────────────

  _checkLevelUp() {
    const xp_needed = this.level * 100;
    if (this.xp >= xp_needed) {
      this.xp -= xp_needed;
      this.level++;
      this.coins += 20;
      this._addMemory(`Subiste al nivel ${this.level}!`);
    }
  }

  // ─── Memoria ───────────────────────────────────────────────────────────

  _addMemory(text) {
    this.memories.unshift({ text, ts: Date.now() });
    if (this.memories.length > 10) this.memories.pop();
  }

  // ─── Serialización ─────────────────────────────────────────────────────

  toJson() { return JSON.parse(JSON.stringify(this)); }

  static fromJson(data) { return new Pet(data); }
}
