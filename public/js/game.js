/**
 * game.js – Motor principal de LlamaGochi Web
 *
 * Máquina de estados: HOUSE → MENU → SHOP / MINIGAME / INVENTORY
 * Port de GameEngine.cpp adaptado para navegador.
 */

'use strict';

const SCREENS = {
  NEW_PET:   'NEW_PET',
  HOUSE:     'HOUSE',
  MENU:      'MENU',
  SHOP:      'SHOP',
  INVENTORY: 'INVENTORY',
  MINIGAME:  'MINIGAME',
  EVOLUTION: 'EVOLUTION',
};

const MENU_ITEMS = ['Alimentar','Jugar','Dormir','Curar','Tienda','Casa','Inventario','Compendio'];
const SHOP_COUNT = 9;

class Game {
  constructor() {
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas);
    this.minigames = new MiniGames(this.canvas, this.renderer);
    this.wardrobe  = new Wardrobe();

    this.pet       = null;
    this.deviceId  = null;
    this.screen    = SCREENS.NEW_PET;
    this.menuState = { selected: 0 };

    this._saveTimer  = null;
    this._tickTimer  = null;

    this._setupButtons();
    this._setupNewPetScreen();
    this._loadFromServer();
  }

  // ─── Configuración inicial ────────────────────────────────────────────

  _setupButtons() {
    const map = { 'btn-a':'a', 'btn-b':'b', 'btn-c':'c', 'btn-d':'d' };
    Object.entries(map).forEach(([id, btn]) => {
      document.getElementById(id).addEventListener('click', () => this._handleButton(btn));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'z' || e.key === 'Z') this._handleButton('a');
      if (e.key === 'x' || e.key === 'X') this._handleButton('b');
      if (e.key === 'ArrowUp')            this._handleButton('c');
      if (e.key === 'ArrowDown')          this._handleButton('d');
    });
  }

  _setupNewPetScreen() {
    const overlay = document.getElementById('screen-overlay');
    overlay.style.display = 'flex';

    document.querySelectorAll('.species-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.species-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('btn-create').addEventListener('click', () => {
      const name    = document.getElementById('pet-name').value.trim() || 'Llama';
      const specBtn = document.querySelector('.species-btn.active');
      const species = parseInt(specBtn?.dataset.species || '0');
      this._createPet(name, species);
    });
  }

  async _loadFromServer() {
    const saved = localStorage.getItem('llamagochi_device_id');
    if (!saved) return;

    try {
      const resp = await fetch(`/api/game/load/${saved}`);
      if (!resp.ok) return;
      const data = await resp.json();
      this.deviceId = data.device_id;
      this.pet = Pet.fromJson(data.pet);
      this._startGame();
    } catch (e) {
      console.warn('No se pudo cargar desde servidor:', e);
    }
  }

  async _createPet(name, species) {
    try {
      const resp = await fetch('/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, species })
      });
      const data = await resp.json();
      this.deviceId = data.device_id;
      this.pet      = Pet.fromJson(data.pet);
      this.pet.name    = name;
      this.pet.species = species;
      localStorage.setItem('llamagochi_device_id', this.deviceId);
      this._startGame();
    } catch (e) {
      console.error('Error creando pet:', e);
    }
  }

  _startGame() {
    document.getElementById('screen-overlay').style.display = 'none';
    this.screen = SCREENS.HOUSE;
    this.menuState = { selected: 0 };

    // Ticks del juego cada 10 minutos
    this._tickTimer = setInterval(() => {
      if (this.pet && !this.pet.is_dead) {
        const prevStage = this.pet.stage;
        this.pet.tick();
        if (this.pet.stage !== prevStage) {
          this.screen = SCREENS.EVOLUTION;
          Renderer.showDialog(`¡Estoy creciendo! ¡Mira qué grande! 🌟`, 4000);
        }
        if (this.pet.is_dead) {
          this._showNotification('Adiós... te quise mucho 😢', 5000);
        }
        // Alertas narrativas de stats críticos
        if (this.pet.hunger < 20)    Renderer.showDialog('¡Tengo muuucha hambre! 😭');
        else if (this.pet.health < 20) Renderer.showDialog('No me siento bien... 🤒');
        else if (this.pet.energy < 20) Renderer.showDialog('Estoy muy cansado... 😴');
      }
    }, 10 * 60 * 1000);

    // Auto-guardado cada 60 segundos
    this._saveTimer = setInterval(() => this._save(), 60_000);

    // Loop de render a ~30fps
    const renderLoop = () => {
      if (this.pet) {
        if (this.screen !== SCREENS.MINIGAME) {
          this.renderer.render(this.pet, this.screen, this.menuState);
        }
      }
      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);

    // Trigger de tick inmediato para compensar tiempo pasado sin jugar
    if (this.pet) this.pet.tick();
    this._updateButtonLabels();

    // Saludo narrativo al iniciar
    const greetings = [
      `¡Hola! ¡Soy ${this.pet.name}! 🦙`,
      `¡Qué bueno verte de nuevo! ✨`,
      `¡Hoy va a ser un gran día! 🌟`,
    ];
    setTimeout(() => {
      Renderer.showDialog(greetings[Math.floor(Math.random() * greetings.length)], 3000);
    }, 800);
  }

  // ─── Input de botones ─────────────────────────────────────────────────

  _handleButton(btn) {
    if (!this.pet || this.pet.is_dead) return;

    if (this.screen === SCREENS.MINIGAME) {
      this.minigames.handleButton(btn);
      return;
    }

    if (this.screen === SCREENS.EVOLUTION) {
      if (btn === 'a') { this.screen = SCREENS.HOUSE; this._updateButtonLabels(); }
      return;
    }

    if (this.screen === SCREENS.HOUSE) {
      if (btn === 'a') this._quickAction();
      if (btn === 'b') { this.screen = SCREENS.MENU; this.menuState.selected = 0; this._updateButtonLabels(); }
    }
    else if (this.screen === SCREENS.MENU) {
      if (btn === 'c') this.menuState.selected = Math.max(0, this.menuState.selected - 1);
      if (btn === 'd') this.menuState.selected = Math.min(MENU_ITEMS.length - 1, this.menuState.selected + 1);
      if (btn === 'a') this._executeMenuItem(this.menuState.selected);
      if (btn === 'b') { this.screen = SCREENS.HOUSE; this._updateButtonLabels(); }
    }
    else if (this.screen === SCREENS.SHOP) {
      if (btn === 'c') this.menuState.selected = Math.max(0, this.menuState.selected - 1);
      if (btn === 'd') this.menuState.selected = Math.min(SHOP_COUNT - 1, this.menuState.selected + 1);
      if (btn === 'a') this._buyItem(this.menuState.selected);
      if (btn === 'b') { this.screen = SCREENS.MENU; this._updateButtonLabels(); }
    }
    else if (this.screen === SCREENS.INVENTORY) {
      if (btn === 'c') this.menuState.selected = Math.max(0, this.menuState.selected - 1);
      if (btn === 'd') this.menuState.selected = Math.min(this.pet.inventory.length - 1, this.menuState.selected + 1);
      if (btn === 'a') this._useInventoryItem();
      if (btn === 'b') { this.screen = SCREENS.MENU; this._updateButtonLabels(); }
    }
  }

  // ─── Acciones ─────────────────────────────────────────────────────────

  _quickAction() {
    // Acción rápida: alimentar si hay comida, sino jugar
    const food = this.pet.inventory.find(e => {
      const item = ITEM_CATALOG.find(i => i.id === e.id);
      return item && item.type === 0 && e.qty > 0;
    });
    if (food) {
      this.pet.feed(food.id);
      Renderer.showDialog('¡Mmm qué rico! ¡Gracias! 😋');
    } else {
      if (this.pet.play()) Renderer.showDialog('¡Yay! ¡A jugar! 🎉');
      else Renderer.showDialog('Estoy muy cansado para jugar... 😴');
    }
  }

  _executeMenuItem(idx) {
    switch (idx) {
      case 0: // Alimentar
        if (this.pet.hunger < 95) {
          const food = this.pet.inventory.find(e => ITEM_CATALOG.find(i => i.id === e.id && i.type === 0));
          if (food) { this.pet.feed(food.id); Renderer.showDialog('¡Delicioso! ¡Gracias! 😋'); }
          else { Renderer.showDialog('No tengo comida... ¿me traes algo? 🍽'); }
        } else Renderer.showDialog('¡Estoy llena, no puedo más! 😅');
        break;
      case 1: // Jugar
        if (this.pet.play()) {
          this._startMiniGame();
          return;
        } else Renderer.showDialog('Estoy muy cansado para jugar... 😴');
        break;
      case 2: // Dormir
        if (this.pet.sleep_action()) Renderer.showDialog('Buenas noches... 💤 zzz');
        else { this.pet.wake_up(); Renderer.showDialog('¡Buenos días! ¡A despertar! ☀️'); }
        break;
      case 3: // Curar
        const med = this.pet.inventory.find(e => ITEM_CATALOG.find(i => i.id === e.id && i.type === 2));
        if (med) { this.pet.heal(med.id); Renderer.showDialog('¡Me siento mucho mejor! 💊 ✨'); }
        else Renderer.showDialog('No tengo medicina... 😟');
        break;
      case 4: // Tienda
        this.screen = SCREENS.SHOP;
        this.menuState.selected = 0;
        this._updateButtonLabels();
        return;
      case 5: // Casa (sobres)
        this._openPack();
        break;
      case 6: // Inventario
        this.screen = SCREENS.INVENTORY;
        this.menuState.selected = 0;
        this._updateButtonLabels();
        return;
      case 7: // Compendio (leaderboard)
        this._showLeaderboard();
        break;
    }
    this.screen = SCREENS.HOUSE;
    this._updateButtonLabels();
  }

  _buyItem(idx) {
    if (this.pet.buyItem(idx)) {
      const item = ITEM_CATALOG.find(i => i.id === idx);
      Renderer.showDialog(`¡Yay! ¡Tengo ${item?.name}! 🛍️`);
    } else {
      Renderer.showDialog('No tengo suficientes monedas 😢');
    }
  }

  _useInventoryItem() {
    if (this.pet.inventory.length === 0) return;
    const entry = this.pet.inventory[this.menuState.selected];
    if (!entry) return;
    const item = ITEM_CATALOG.find(i => i.id === entry.id);
    if (!item) return;

    if (item.type === 0 || item.type === 2) {
      const ok = item.type === 0 ? this.pet.feed(entry.id) : this.pet.heal(entry.id);
      if (ok) Renderer.showDialog(item.type === 0 ? `¡${item.name}! ¡Riquísimo! 😋` : `¡Me curé con ${item.name}! 💊`);
    } else if (item.type === 3 || item.type === 4) {
      if (this.wardrobe.equip(entry.id, this.pet)) {
        Renderer.showDialog(`¡Me puse ${item.name}! ¡Qué guapa! 💃`);
      }
    }
    this.menuState.selected = Math.min(this.menuState.selected, this.pet.inventory.length - 1);
  }

  _startMiniGame() {
    const types = ['simon', 'reaction', 'guess'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.screen = SCREENS.MINIGAME;
    this.minigames.start(type, this.pet, (coins, msg) => {
      if (coins > 0) { this.pet.coins += coins; }
      Renderer.showDialog(coins > 0 ? `¡Gané ${coins} monedas! 🎉` : `¡La próxima vez gano! 💪`);
      this.screen = SCREENS.HOUSE;
      this._updateButtonLabels();
    });
  }

  _openPack() {
    const packType = this.pet.coins >= 400 ? 'EPIC' : this.pet.coins >= 150 ? 'RARE' : 'COMMON';
    const result = this.wardrobe.openPack(packType, this.pet);
    if (!result.ok) { this._showNotification(result.reason); return; }
    const names = result.items.map(i => i.name).join(', ');
    Renderer.showDialog(`¡Sobre ${packType}! Obtuve: ${names} ✨`);
  }

  async _showLeaderboard() {
    try {
      const resp = await fetch('/api/leaderboard');
      const data = await resp.json();
      if (data.length === 0) { Renderer.showDialog('¡El leaderboard está vacío!'); return; }
      const top = data.slice(0, 3).map((r, i) => `${i+1}. ${r.pet_name} Lv${r.level}`).join(' · ');
      Renderer.showDialog(top, 5000);
    } catch (e) {
      Renderer.showDialog('No pude conectarme 📡');
    }
  }

  // ─── Guardado ─────────────────────────────────────────────────────────

  async _save() {
    if (!this.pet || !this.deviceId) return;
    try {
      await fetch('/api/game/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: this.deviceId, pet: this.pet.toJson() })
      });
    } catch (e) { /* silencioso */ }
  }

  // ─── Labels de botones ────────────────────────────────────────────────

  _updateButtonLabels() {
    const labels = {
      [SCREENS.HOUSE]:     { a:'Acción', b:'Menú',    c:'▲',      d:'▼'      },
      [SCREENS.MENU]:      { a:'OK',     b:'Volver',  c:'▲',      d:'▼'      },
      [SCREENS.SHOP]:      { a:'Comprar',b:'Volver',  c:'▲',      d:'▼'      },
      [SCREENS.INVENTORY]: { a:'Usar',   b:'Volver',  c:'▲',      d:'▼'      },
      [SCREENS.EVOLUTION]: { a:'OK',     b:'',        c:'',       d:''       },
    };
    const l = labels[this.screen] || labels[SCREENS.HOUSE];
    document.getElementById('label-a').textContent = l.a;
    document.getElementById('label-b').textContent = l.b;
    document.getElementById('label-c').textContent = l.c;
    document.getElementById('label-d').textContent = l.d;
  }
}

// Guardar al cerrar la ventana
window.addEventListener('beforeunload', () => { if (window._game) window._game._save(); });

// Iniciar el juego cuando cargue la página
window.addEventListener('DOMContentLoaded', () => {
  window._game = new Game();
});
