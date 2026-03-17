#include "MiniGames.h"

MiniGames::MiniGames() {}

void MiniGames::begin(Display* display, uint8_t pin_a, uint8_t pin_b,
                      uint8_t pin_c, uint8_t pin_d, uint8_t pin_buzzer) {
  _display   = display;
  _pin_a = pin_a; _pin_b = pin_b;
  _pin_c = pin_c; _pin_d = pin_d;
  _pin_buzzer = pin_buzzer;
}

bool MiniGames::canPlay(const Pet& pet) const {
  uint32_t today = millis() / 86400000UL;
  if (pet.last_game_day != today) return true;
  return pet.games_played_today < 5;
}

bool MiniGames::_waitButton(uint8_t pin, uint32_t timeout_ms) const {
  uint32_t start = millis();
  while (millis() - start < timeout_ms) {
    if (!digitalRead(pin)) return true;
    delay(10);
  }
  return false;
}

uint8_t MiniGames::_waitAnyButton(uint32_t timeout_ms) const {
  uint32_t start = millis();
  while (millis() - start < timeout_ms) {
    if (!digitalRead(_pin_a)) return 0;
    if (!digitalRead(_pin_b)) return 1;
    if (!digitalRead(_pin_c)) return 2;
    if (!digitalRead(_pin_d)) return 3;
    delay(10);
  }
  return 255; // timeout
}

void MiniGames::_beep(uint16_t freq, uint16_t ms) {
  if (_pin_buzzer != 255) tone(_pin_buzzer, freq, ms);
  delay(ms + 10);
}

void MiniGames::_beepError() {
  _beep(200, 400);
}

void MiniGames::_beepSuccess() {
  _beep(880, 100);
  _beep(1100, 100);
}

// ─── Juego 1: Secuencia Relámpago (Simon Says) ───────────────────────────────
uint16_t MiniGames::playSimon(Pet& pet) {
  if (!canPlay(pet)) {
    _display->showToast("Limite de juegos hoy!");
    return 0;
  }

  uint8_t sequence[10];
  uint8_t seq_len = 3;
  uint8_t correct = 0;

  // Colores por botón
  const uint16_t btn_colors[] = { TFT_RED, TFT_BLUE, TFT_GREEN, TFT_YELLOW };
  const uint16_t btn_notes[]  = { 262, 330, 392, 523 };

  // Título
  _display->tft.fillScreen(TFT_BLACK);
  _display->tft.setTextColor(TFT_WHITE);
  _display->tft.setTextDatum(MC_DATUM);
  _display->tft.setTextSize(2);
  _display->tft.drawString("SIMON!", 120, 60);
  _display->tft.setTextSize(1);
  _display->tft.drawString("Repite la secuencia", 120, 90);
  delay(1500);

  // Generar secuencia aleatoria
  uint32_t seed = millis();
  for (int i = 0; i < 10; i++) {
    seed = seed * 1664525UL + 1013904223UL;
    sequence[i] = (seed >> 16) % 4;
  }

  while (seq_len <= 10) {
    // Mostrar secuencia
    for (int i = 0; i < seq_len; i++) {
      _display->tft.fillScreen(btn_colors[sequence[i]]);
      _beep(btn_notes[sequence[i]], 400);
      _display->tft.fillScreen(TFT_BLACK);
      delay(150);
    }

    // Esperar input del jugador
    bool fail = false;
    for (int i = 0; i < seq_len; i++) {
      uint8_t pressed = _waitAnyButton(3000);
      if (pressed == 255 || pressed != sequence[i]) {
        fail = true;
        break;
      }
      _display->tft.fillScreen(btn_colors[pressed]);
      _beep(btn_notes[pressed], 200);
      _display->tft.fillScreen(TFT_BLACK);
      delay(100);
    }

    if (fail) {
      _beepError();
      _display->showToast("Error! Ronda:" + String(correct));
      break;
    }

    correct++;
    seq_len++;
    _beepSuccess();
    delay(500);
  }

  // Calcular recompensa
  uint16_t coins = correct * 5 + (correct >= 5 ? 15 : 0);
  pet.happiness = (uint8_t)min(100, (int)pet.happiness + correct * 3);
  pet.xp += correct * 5;
  pet.coins += coins;

  // Actualizar límite de juegos
  uint32_t today = millis() / 86400000UL;
  if (pet.last_game_day != today) { pet.games_played_today = 0; pet.last_game_day = today; }
  pet.games_played_today++;

  char msg[32];
  snprintf(msg, sizeof(msg), "+%d coins! Rondas: %d", coins, correct);
  _display->showToast(msg);
  return coins;
}

// ─── Juego 2: Reacción Rápida ────────────────────────────────────────────────
uint16_t MiniGames::playReaction(Pet& pet) {
  if (!canPlay(pet)) {
    _display->showToast("Limite de juegos hoy!");
    return 0;
  }

  const uint8_t ROUNDS = 5;
  uint32_t total_ms = 0;
  uint8_t  hits = 0;

  const uint8_t target_pins[] = { _pin_a, _pin_b, _pin_c, _pin_d };
  const uint16_t target_colors[] = { TFT_RED, TFT_BLUE, TFT_GREEN, TFT_YELLOW };
  const char* target_labels[] = { "A", "B", "C", "D" };

  _display->tft.fillScreen(TFT_BLACK);
  _display->tft.setTextColor(TFT_WHITE);
  _display->tft.setTextDatum(MC_DATUM);
  _display->tft.setTextSize(2);
  _display->tft.drawString("REACCION!", 120, 60);
  delay(1000);

  uint32_t seed = millis();
  for (int r = 0; r < ROUNDS; r++) {
    // Espera aleatoria antes de mostrar target (1-3 segundos)
    seed = seed * 1664525UL + 1013904223UL;
    uint32_t wait = 1000 + (seed >> 16) % 2000;

    _display->tft.fillScreen(TFT_BLACK);
    _display->tft.drawString("...", 120, 160);
    delay(wait);

    // Elegir botón target aleatorio
    seed = seed * 1664525UL + 1013904223UL;
    uint8_t target = (seed >> 16) % 4;

    // Mostrar target
    _display->tft.fillScreen(target_colors[target]);
    _display->tft.setTextColor(TFT_BLACK);
    _display->tft.setTextSize(3);
    _display->tft.drawString(target_labels[target], 120, 140);

    uint32_t t_start = millis();
    bool ok = _waitButton(target_pins[target], 800);
    uint32_t reaction_ms = millis() - t_start;

    _display->tft.fillScreen(TFT_BLACK);

    if (ok && reaction_ms < 700) {
      hits++;
      total_ms += reaction_ms;
      _beepSuccess();
    } else {
      _beepError();
    }
    delay(300);
  }

  uint16_t avg_ms = (hits > 0) ? (total_ms / hits) : 700;
  uint16_t coins = hits * 6 + (avg_ms < 300 ? 10 : 0);
  pet.energy    = (uint8_t)min(100, (int)pet.energy    + hits * 2);
  pet.coins    += coins;
  pet.xp       += hits * 4;

  uint32_t today = millis() / 86400000UL;
  if (pet.last_game_day != today) { pet.games_played_today = 0; pet.last_game_day = today; }
  pet.games_played_today++;

  char msg[32];
  snprintf(msg, sizeof(msg), "+%d coins! Aciertos: %d/5", coins, hits);
  _display->showToast(msg);
  return coins;
}

// ─── Juego 3: Adivina el Número ──────────────────────────────────────────────
uint16_t MiniGames::playGuessNumber(Pet& pet) {
  if (!canPlay(pet)) {
    _display->showToast("Limite de juegos hoy!");
    return 0;
  }

  uint32_t seed = millis() ^ (uint32_t)pet.name[0];
  seed = seed * 1664525UL + 1013904223UL;
  uint8_t secret = (uint8_t)(1 + (seed >> 16) % 10);
  uint8_t guess  = 5;
  uint8_t attempts = 0;
  const uint8_t MAX_ATTEMPTS = 4;
  bool won = false;

  while (attempts < MAX_ATTEMPTS) {
    _display->tft.fillScreen(TFT_BLACK);
    _display->tft.setTextColor(TFT_WHITE);
    _display->tft.setTextDatum(MC_DATUM);
    _display->tft.setTextSize(2);
    _display->tft.drawString("ADIVINA!", 120, 40);
    _display->tft.setTextSize(1);

    char buf[24];
    snprintf(buf, sizeof(buf), "Intento %d/%d", attempts + 1, MAX_ATTEMPTS);
    _display->tft.drawString(buf, 120, 70);
    snprintf(buf, sizeof(buf), "Tu numero: %d", guess);
    _display->tft.drawString(buf, 120, 100);
    _display->tft.drawString("C=sube D=baja A=confirma", 120, 270);

    // Esperar input
    bool confirmed = false;
    while (!confirmed) {
      if (!digitalRead(_pin_c)) { if (guess < 10) guess++; delay(200); }
      if (!digitalRead(_pin_d)) { if (guess > 1)  guess--; delay(200); }
      if (!digitalRead(_pin_a)) { confirmed = true; delay(200); }

      // Actualizar display
      snprintf(buf, sizeof(buf), "Tu numero: %d ", guess);
      _display->tft.setTextColor(TFT_CYAN);
      _display->tft.drawString(buf, 120, 100);
      delay(50);
    }

    attempts++;

    if (guess == secret) {
      won = true;
      _beepSuccess();
      _beepSuccess();
      break;
    } else if (guess < secret) {
      _display->tft.setTextColor(TFT_YELLOW);
      _display->tft.drawString("Mas alto!", 120, 140);
      _beep(300, 200);
    } else {
      _display->tft.setTextColor(TFT_YELLOW);
      _display->tft.drawString("Mas bajo!", 120, 140);
      _beep(300, 200);
    }
    delay(800);
  }

  if (!won) {
    char buf[24];
    snprintf(buf, sizeof(buf), "Era el %d!", secret);
    _display->tft.setTextColor(TFT_RED);
    _display->tft.drawString(buf, 120, 160);
    _beepError();
    delay(2000);
  }

  uint16_t coins = won ? (15 + (MAX_ATTEMPTS - attempts) * 5) : 3;
  pet.happiness = (uint8_t)min(100, (int)pet.happiness + (won ? 15 : 3));
  pet.coins    += coins;
  pet.xp       += won ? 10 : 2;

  uint32_t today = millis() / 86400000UL;
  if (pet.last_game_day != today) { pet.games_played_today = 0; pet.last_game_day = today; }
  pet.games_played_today++;

  char msg[32];
  snprintf(msg, sizeof(msg), won ? "+%d coins! Ganaste!" : "+%d coins.", coins);
  _display->showToast(msg);
  return coins;
}
