#include "Display.h"

// ─── Colores personalizados ──────────────────────────────────────────────────
#define COL_BG_DAY      0x0537  // azul cielo
#define COL_BG_NIGHT    0x0208  // azul oscuro
#define COL_BG_COLD     0xC5FF  // azul hielo
#define COL_BG_HOT      0xFBE0  // naranja caluroso
#define COL_FLOOR       0x8B4D  // marrón suelo
#define COL_WALL_1      0xF7BE  // beige pared
#define COL_STAT_HUNGER 0xFB00  // naranja
#define COL_STAT_HAPPY  0xFFE0  // amarillo
#define COL_STAT_HEALTH 0x07E0  // verde
#define COL_STAT_ENERGY 0x041F  // azul
#define COL_COIN        0xFFE0  // amarillo moneda
#define COL_EMPTY_BAR   0x4208  // gris oscuro

Display::Display() : canvas(&tft) {
  _anim_frame    = 0;
  _anim_timer    = 0;
  _toast_until   = 0;
  _dialogue_until= 0;
  memset(_toast_text, 0, sizeof(_toast_text));
  memset(_dialogue_text, 0, sizeof(_dialogue_text));
}

void Display::begin() {
  tft.init();
  tft.setRotation(0);   // Portrait 240x320
  tft.fillScreen(TFT_BLACK);
  canvas.createSprite(240, 320);
  canvas.setSwapBytes(true);
}

void Display::showSplash() {
  canvas.fillSprite(TFT_BLACK);
  canvas.setTextColor(TFT_WHITE, TFT_BLACK);
  canvas.setTextDatum(MC_DATUM);
  canvas.setFreeFont(nullptr);
  canvas.setTextSize(2);
  canvas.drawString("TAMAGOTCHI", 120, 130);
  canvas.setTextSize(1);
  canvas.drawString("NEXT LEVEL", 120, 160);
  canvas.drawString("v1.0 - ESP32", 120, 200);
  canvas.pushSprite(0, 0);
  delay(2000);
}

// ─── Render principal ────────────────────────────────────────────────────────
void Display::render(const Pet& pet, Screen screen) {
  canvas.fillSprite(TFT_BLACK);

  switch (screen) {
    case Screen::HOUSE:      _renderHouse(pet);     break;
    case Screen::MENU:       _renderMenu(pet);      break;
    case Screen::INVENTORY:  _renderInventory(pet); break;
    case Screen::COMPENDIUM: _renderCompendium();   break;
    case Screen::MEMORIES:   _renderMemories(pet);  break;
    default: break;
  }

  // Diálogo superpuesto
  if (millis() < _dialogue_until && _dialogue_text[0]) {
    // Fondo del diálogo
    canvas.fillRoundRect(10, 260, 220, 50, 8, TFT_BLACK);
    canvas.drawRoundRect(10, 260, 220, 50, 8, TFT_WHITE);
    canvas.setTextColor(TFT_WHITE);
    canvas.setTextDatum(TL_DATUM);
    canvas.setTextSize(1);
    canvas.drawString(_dialogue_text, 18, 270);
  }

  // Toast superpuesto
  if (millis() < _toast_until && _toast_text[0]) {
    canvas.fillRect(0, 300, 240, 20, TFT_DARKGREY);
    canvas.setTextColor(TFT_WHITE);
    canvas.setTextDatum(MC_DATUM);
    canvas.setTextSize(1);
    canvas.drawString(_toast_text, 120, 310);
  }

  canvas.pushSprite(0, 0);
}

// ─── Pantalla HOUSE ──────────────────────────────────────────────────────────
void Display::_renderHouse(const Pet& pet) {
  // Fondo dinámico según temperatura/hora
  _drawHouseBackground(pet);

  // Piso
  canvas.fillRect(0, 220, 240, 100, COL_FLOOR);

  // Mueble izquierdo
  if (pet.house.furniture_l >= 0) {
    canvas.fillRect(10, 180, 40, 40, TFT_DARKGREY);
    canvas.drawRect(10, 180, 40, 40, TFT_WHITE);
    canvas.setTextColor(TFT_WHITE);
    canvas.setTextDatum(MC_DATUM);
    canvas.setTextSize(1);
    const char* labels[] = { "Cama", "Sofa", "TV", "Planta", "Mesa" };
    uint8_t idx = min((uint8_t)4, (uint8_t)pet.house.furniture_l);
    canvas.drawString(labels[idx], 30, 200);
  }

  // Mueble derecho
  if (pet.house.furniture_r >= 0) {
    canvas.fillRect(190, 180, 40, 40, TFT_DARKGREY);
    canvas.drawRect(190, 180, 40, 40, TFT_WHITE);
  }

  // Sprite del pet (centrado, animado)
  uint32_t now = millis();
  if (now - _anim_timer > 600) {
    _anim_frame = (_anim_frame + 1) % 2;
    _anim_timer = now;
  }
  int16_t pet_y = pet.is_sleeping ? 210 : (200 - (_anim_frame * 3));
  _drawPetSprite(pet, 104, pet_y);

  // Barra de stats (derecha)
  _drawStatBars(pet, 195, 5);

  // Contador de monedas (superior izquierdo)
  _drawCoinCounter(pet.coins, 5, 5);

  // Barra de pasos (superior)
  _drawStepBar(pet.owner_steps_today, 60, 5);

  // Ícono ambiental (esquina superior derecha de la barra)
  _drawWeatherIcon(0, 220, 5);
}

void Display::_drawHouseBackground(const Pet& pet) {
  // Color de cielo según condición ambiental (simplificado)
  uint16_t sky_color = COL_BG_DAY;
  canvas.fillSprite(sky_color);

  // Tapiz de pared según house.wallpaper_id
  uint16_t wall_color = COL_WALL_1;
  if (pet.house.wallpaper_id == 1) wall_color = 0xF81F; // rosa
  if (pet.house.wallpaper_id == 2) wall_color = 0x001F; // azul
  canvas.fillRect(0, 60, 240, 170, wall_color);

  // Suelo según house.floor_id
  uint16_t floor_color = COL_FLOOR;
  if (pet.house.floor_id == 1) floor_color = 0x7BCF; // gris mármol
  if (pet.house.floor_id == 2) floor_color = 0xA514; // marrón alfombra
  canvas.fillRect(0, 220, 240, 100, floor_color);
}

void Display::_drawPetSprite(const Pet& pet, int16_t x, int16_t y) {
  const uint16_t* sprite = getSpriteForPet((uint8_t)pet.species, (uint8_t)pet.stage);
  uint16_t tint = speciesColor((uint8_t)pet.species);
  _drawSprite(sprite, x, y, SPRITE_W, SPRITE_H, tint);

  // Si está dormido, dibujar "ZZZ"
  if (pet.is_sleeping) {
    canvas.setTextColor(TFT_WHITE);
    canvas.setTextSize(1);
    canvas.drawString("Zzz", x + 30, y - 10);
  }

  // Nombre del pet
  canvas.setTextColor(TFT_WHITE);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextSize(1);
  canvas.drawString(pet.name, x + 16, y + SPRITE_H + 4);
  canvas.drawString(pet.evolution_key, x + 16, y + SPRITE_H + 14);
}

// ─── Barras de stats ─────────────────────────────────────────────────────────
void Display::_drawStatBars(const Pet& pet, int16_t x, int16_t y) {
  struct { uint8_t val; uint16_t col; const char* lbl; } stats[] = {
    { pet.hunger,    COL_STAT_HUNGER, "H" },
    { pet.happiness, COL_STAT_HAPPY,  "F" },
    { pet.health,    COL_STAT_HEALTH, "S" },
    { pet.energy,    COL_STAT_ENERGY, "E" },
  };

  for (int i = 0; i < 4; i++) {
    int16_t bar_y = y + i * 22;
    canvas.setTextColor(TFT_WHITE);
    canvas.setTextSize(1);
    canvas.drawString(stats[i].lbl, x, bar_y + 2);
    _drawBar(x + 10, bar_y, 30, 8, stats[i].val, stats[i].col, COL_EMPTY_BAR);
  }
}

void Display::_drawBar(int16_t x, int16_t y, int16_t w, int16_t h,
                       uint8_t value, uint16_t color_full, uint16_t color_empty) {
  canvas.fillRect(x, y, w, h, color_empty);
  int16_t filled = (int16_t)(w * value / 100);
  if (filled > 0)
    canvas.fillRect(x, y, filled, h, color_full);
  canvas.drawRect(x, y, w, h, TFT_WHITE);
}

void Display::_drawCoinCounter(uint16_t coins, int16_t x, int16_t y) {
  canvas.setTextColor(COL_COIN);
  canvas.setTextSize(1);
  char buf[12];
  snprintf(buf, sizeof(buf), "%d$", coins);
  canvas.drawString(buf, x, y);
}

void Display::_drawStepBar(uint32_t steps, int16_t x, int16_t y) {
  canvas.setTextColor(TFT_CYAN);
  canvas.setTextSize(1);
  char buf[16];
  snprintf(buf, sizeof(buf), "%lu pasos", (unsigned long)steps);
  canvas.drawString(buf, x, y);
}

void Display::_drawWeatherIcon(uint8_t icon, int16_t x, int16_t y) {
  // Solo dibuja un pequeño ícono de texto por ahora
  const char* icons[] = { "SOL", "NUB", "FRI", "CAL", "LLU" };
  canvas.setTextColor(TFT_YELLOW);
  canvas.setTextSize(1);
  canvas.drawString(icons[min(icon, (uint8_t)4)], x, y);
}

// ─── Pantalla MENU ──────────────────────────────────────────────────────────
void Display::_renderMenu(const Pet& pet) {
  canvas.fillSprite(0x1082); // fondo oscuro semi-transparente
  canvas.drawRect(20, 40, 200, 240, TFT_WHITE);
  canvas.fillRect(21, 41, 198, 238, 0x1082);

  const char* items[] = {
    "Alimentar",
    "Jugar",
    "Dormir",
    "Curar",
    "Tienda",
    "Casa",
    "Inventario",
    "Compendio"
  };

  canvas.setTextColor(TFT_WHITE);
  canvas.setTextDatum(TL_DATUM);
  canvas.setTextSize(1);
  for (int i = 0; i < 8; i++) {
    canvas.drawString(items[i], 35, 55 + i * 26);
  }
}

// ─── Pantalla INVENTORY ──────────────────────────────────────────────────────
void Display::_renderInventory(const Pet& pet) {
  canvas.fillSprite(TFT_BLACK);
  _drawCentered("INVENTARIO", 10, 1, TFT_CYAN);

  for (int i = 0; i < min((int)pet.inventory_count, 12); i++) {
    int row = i / 3;
    int col = i % 3;
    int16_t bx = 10 + col * 75;
    int16_t by = 30 + row * 70;
    canvas.fillRect(bx, by, 65, 60, 0x2104);
    canvas.drawRect(bx, by, 65, 60, TFT_WHITE);
    canvas.setTextColor(TFT_WHITE);
    canvas.setTextSize(1);
    canvas.drawString(pet.inventory[i].name, bx + 3, by + 40);

    // Borde de rareza
    uint16_t rarity_colors[] = { TFT_SILVER, TFT_GREEN, TFT_BLUE, TFT_GOLD };
    uint8_t r = min((uint8_t)3, pet.inventory[i].rarity);
    canvas.drawRect(bx+1, by+1, 63, 58, rarity_colors[r]);
  }
}

// ─── Pantalla COMPENDIUM ────────────────────────────────────────────────────
void Display::_renderCompendium() {
  canvas.fillSprite(TFT_BLACK);
  _drawCentered("COMPENDIO", 10, 1, TFT_CYAN);
  canvas.setTextColor(TFT_DARKGREY);
  canvas.setTextDatum(MC_DATUM);
  canvas.drawString("Pets anteriores", 120, 50);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString("(cargando...)", 120, 80);
}

// ─── Pantalla MEMORIES ──────────────────────────────────────────────────────
void Display::_renderMemories(const Pet& pet) {
  canvas.fillSprite(TFT_BLACK);
  _drawCentered("RECUERDOS", 5, 1, TFT_YELLOW);

  for (int i = 0; i < pet.memory_count; i++) {
    canvas.setTextColor(TFT_WHITE);
    canvas.setTextSize(1);
    canvas.drawString(pet.memories[i].description, 5, 25 + i * 28);

    // Timestamp relativo
    uint32_t ago_min = (millis() - pet.memories[i].timestamp) / 60000UL;
    char ts_buf[16];
    snprintf(ts_buf, sizeof(ts_buf), "hace %lumin", (unsigned long)ago_min);
    canvas.setTextColor(TFT_DARKGREY);
    canvas.drawString(ts_buf, 5, 37 + i * 28);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
void Display::_drawSprite(const uint16_t* sprite_pgm, int16_t x, int16_t y,
                          uint8_t w, uint8_t h, uint16_t tint) {
  for (int py = 0; py < h; py++) {
    for (int px = 0; px < w; px++) {
      uint16_t pixel = pgm_read_word(&sprite_pgm[py * w + px]);
      if (pixel == TRANSPARENT) continue;
      // Aplicar tinte: si el pixel es el color de "cuerpo" (0xEEEE), usar tint
      if (pixel == 0xEEEE) pixel = tint;
      canvas.drawPixel(x + px, y + py, pixel);
    }
  }
}

void Display::_drawCentered(const char* text, int16_t y, uint8_t font, uint16_t color) {
  canvas.setTextColor(color);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextSize(font);
  canvas.drawString(text, 120, y);
}

void Display::showDialogue(const char* text, uint16_t duration_ms) {
  strlcpy(_dialogue_text, text, sizeof(_dialogue_text));
  _dialogue_until = millis() + duration_ms;
}

void Display::showToast(const char* text, uint16_t color) {
  strlcpy(_toast_text, text, sizeof(_toast_text));
  _toast_until = millis() + 2500;
}

void Display::flashScreen(uint16_t color, uint8_t times) {
  for (int i = 0; i < times; i++) {
    tft.fillScreen(color);
    delay(80);
    tft.fillScreen(TFT_BLACK);
    delay(80);
  }
}
