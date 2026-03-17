/**
 * minigames.js – Port de MiniGames.h para LlamaGochi Web
 *
 * Tres minijuegos con los 4 botones:
 *  1. Secuencia Rayo (Simon Says)
 *  2. Reacción Rápida
 *  3. Adivina el Número (botones C/D)
 */

'use strict';

const MAX_GAMES_PER_DAY = 5;
const BTN_COLORS = { a:'#e05050', b:'#e0a030', c:'#4080e0', d:'#40b060' };

class MiniGames {
  constructor(canvas, renderer) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.renderer = renderer;
    this.active   = false;
    this.type     = null;   // 'simon' | 'reaction' | 'guess'
    this.onDone   = null;   // callback(coinsEarned)
  }

  // ─── Iniciar minijuego ────────────────────────────────────────────────

  start(type, pet, onDone) {
    const today = Math.floor(Date.now() / 86_400_000);
    if (pet.last_game_day === today && pet.games_played_today >= MAX_GAMES_PER_DAY) {
      onDone(0, 'Límite de juegos diarios alcanzado');
      return;
    }
    if (today !== pet.last_game_day) {
      pet.games_played_today = 0;
      pet.last_game_day = today;
    }
    this.active  = true;
    this.type    = type;
    this.onDone  = onDone;
    this.pet     = pet;

    if (type === 'simon')    this._startSimon();
    if (type === 'reaction') this._startReaction();
    if (type === 'guess')    this._startGuess();
  }

  handleButton(btn) {
    if (!this.active) return;
    if (this.type === 'simon')    this._simonInput(btn);
    if (this.type === 'reaction') this._reactionInput(btn);
    if (this.type === 'guess')    this._guessInput(btn);
  }

  _finish(coins, msg) {
    this.active = false;
    if (coins > 0) {
      this.pet.games_played_today++;
      this.pet.happiness = Math.min(100, this.pet.happiness + 10);
      this.pet.xp       += 10;
    }
    if (this.onDone) this.onDone(coins, msg);
  }

  // ─── 1. Simon Says ────────────────────────────────────────────────────

  _startSimon() {
    this.simon = { sequence: [], playerIdx: 0, showing: false, level: 1 };
    this._simonAddStep();
    this._simonShow();
  }

  _simonAddStep() {
    const btns = ['a','b','c','d'];
    this.simon.sequence.push(btns[Math.floor(Math.random() * 4)]);
  }

  _simonShow() {
    this.simon.showing = true;
    this.simon.playerIdx = 0;
    this._drawSimon('¡Observa!', null);

    let i = 0;
    const showNext = () => {
      if (i >= this.simon.sequence.length) {
        setTimeout(() => {
          this.simon.showing = false;
          this._drawSimon('¡Ahora tú!', null);
        }, 500);
        return;
      }
      const btn = this.simon.sequence[i];
      setTimeout(() => {
        this._drawSimon('¡Observa!', btn);
        setTimeout(() => {
          this._drawSimon('¡Observa!', null);
          i++;
          showNext();
        }, 600);
      }, 400);
    };
    showNext();
  }

  _simonInput(btn) {
    if (this.simon.showing) return;
    const expected = this.simon.sequence[this.simon.playerIdx];
    if (btn !== expected) {
      this._drawSimon('¡ERROR!', btn);
      setTimeout(() => this._finish(0, 'Simon: fallaste'), 1000);
      return;
    }
    this._drawSimon('✓', btn);
    this.simon.playerIdx++;
    if (this.simon.playerIdx >= this.simon.sequence.length) {
      const coins = 5 + this.simon.level * 2;
      this.simon.level++;
      if (this.simon.level > 5) {
        setTimeout(() => this._finish(coins, `Simon: ¡+${coins} monedas!`), 800);
      } else {
        setTimeout(() => {
          this._simonAddStep();
          this._simonShow();
        }, 1000);
      }
    }
  }

  _drawSimon(msg, highlight) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, 240, 320);
    this.renderer._drawText('SIMON SAYS', 40, 30, '#00ff00', 8);
    this.renderer._drawText(`Nivel ${this.simon.level}`, 80, 55, '#80ff80', 6);
    this.renderer._drawText(msg, 80, 100, '#ffffff', 7);

    // 4 cuadrados de colores
    const btns = [
      { key:'a', x:20,  y:140, label:'A' },
      { key:'b', x:80,  y:140, label:'B' },
      { key:'c', x:140, y:140, label:'C' },
      { key:'d', x:200, y:140, label:'D' },
    ];
    btns.forEach(b => {
      ctx.fillStyle = highlight === b.key ? BTN_COLORS[b.key] : '#333';
      ctx.fillRect(b.x, b.y, 36, 36);
      ctx.strokeStyle = BTN_COLORS[b.key];
      ctx.strokeRect(b.x, b.y, 36, 36);
      this.renderer._drawText(b.label, b.x+12, b.y+24, '#fff', 8);
    });

    // Secuencia hasta ahora
    const seqStr = this.simon.sequence.map(s => s.toUpperCase()).join('-');
    this.renderer._drawText(seqStr, 20, 210, '#606060', 6);
  }

  // ─── 2. Reacción Rápida ───────────────────────────────────────────────

  _startReaction() {
    this.reaction = { target: null, startTime: null, waiting: true };
    this._drawReaction('Espera...', null);
    const delay = 1500 + Math.random() * 2500;
    this._reactionTimeout = setTimeout(() => {
      const btns = ['a','b','c','d'];
      this.reaction.target    = btns[Math.floor(Math.random() * 4)];
      this.reaction.startTime = Date.now();
      this.reaction.waiting   = false;
      this._drawReaction(`¡Pulsa ${this.reaction.target.toUpperCase()}!`, this.reaction.target);
      // Tiempo límite
      this._reactionLimit = setTimeout(() => {
        if (this.active) this._finish(0, 'Reacción: demasiado lento');
      }, 500);
    }, delay);
  }

  _reactionInput(btn) {
    clearTimeout(this._reactionTimeout);
    clearTimeout(this._reactionLimit);
    if (this.reaction.waiting) {
      this._finish(0, 'Reacción: muy pronto!');
      return;
    }
    const elapsed = Date.now() - this.reaction.startTime;
    if (btn === this.reaction.target && elapsed <= 500) {
      const coins = elapsed < 200 ? 10 : elapsed < 350 ? 7 : 5;
      this._drawReaction(`¡${elapsed}ms! +${coins}c`, btn);
      setTimeout(() => this._finish(coins, `Reacción: ¡+${coins} monedas!`), 800);
    } else {
      this._finish(0, 'Reacción: botón incorrecto');
    }
  }

  _drawReaction(msg, highlight) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, 240, 320);
    this.renderer._drawText('REACCIÓN', 60, 30, '#ff8800', 8);
    this.renderer._drawText('¡Pulsa el botón!', 30, 60, '#aaaaaa', 6);

    // Botón objetivo (grande)
    if (highlight) {
      const colors = { a:'#e05050',b:'#e0a030',c:'#4080e0',d:'#40b060' };
      ctx.fillStyle = colors[highlight];
      ctx.beginPath();
      ctx.arc(120, 160, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 1;
      this.renderer._drawText(highlight.toUpperCase(), 110, 168, '#fff', 14);
    }

    this.renderer._drawText(msg, 30, 240, '#ffffff', 6);
    this.renderer._drawText('Menos de 500ms', 30, 270, '#606060', 5);
  }

  // ─── 3. Adivina el Número ─────────────────────────────────────────────

  _startGuess() {
    this.guess = {
      target:   1 + Math.floor(Math.random() * 10),
      current:  5,
      attempts: 0,
      maxTries: 5
    };
    this._drawGuess();
  }

  _guessInput(btn) {
    if (btn === 'c') this.guess.current = Math.min(10, this.guess.current + 1);
    if (btn === 'd') this.guess.current = Math.max(1,  this.guess.current - 1);
    if (btn === 'a') {
      this.guess.attempts++;
      if (this.guess.current === this.guess.target) {
        const coins = 10 - this.guess.attempts;
        this._drawGuess(`¡Correcto! Era ${this.guess.target}`);
        setTimeout(() => this._finish(Math.max(2, coins), `Adivina: ¡+${Math.max(2, coins)}!`), 1000);
        return;
      }
      if (this.guess.attempts >= this.guess.maxTries) {
        this._drawGuess(`Era ${this.guess.target}. Game over.`);
        setTimeout(() => this._finish(0, 'Adivina: sin intentos'), 1000);
        return;
      }
    }
    if (btn === 'b') {
      this._finish(0, 'Adivina: abandonado');
      return;
    }
    this._drawGuess();
  }

  _drawGuess(msg) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, 240, 320);
    this.renderer._drawText('ADIVINA', 65, 30, '#4488ff', 8);
    this.renderer._drawText('el número (1-10)', 20, 55, '#aaaaaa', 6);

    // Número actual
    ctx.fillStyle = '#1a3060';
    ctx.fillRect(80, 90, 80, 60);
    ctx.strokeStyle = '#4488ff';
    ctx.strokeRect(80, 90, 80, 60);
    this.renderer._drawText(String(this.guess.current), 106, 132, '#ffffff', 16);

    // Pista de pistas
    const hint = !msg ? (
      this.guess.attempts > 0
        ? (this.guess.current > this.guess.target ? '↓ Más bajo' : '↑ Más alto')
        : 'C/D para ajustar'
    ) : msg;
    this.renderer._drawText(hint, 20, 175, '#80ff80', 6);

    this.renderer._drawText(`Intentos: ${this.guess.attempts}/${this.guess.maxTries}`, 20, 200, '#aaaaaa', 6);
    this.renderer._drawText('[C]▲  [D]▼  [A] OK  [B] Salir', 14, SCREEN_H - 10, '#404040', 5);
  }
}
