#include "GameEngine.h"

// ─── Catálogo de items ────────────────────────────────────────────────────────
const Item ITEMS_CATALOG[] = {
  // id  name              type  hun  hap  hlt  ene  rarity
  { 0,  "Comida basica",   0,   20,   0,   0,   0,   0 },
  { 1,  "Comida premium",  0,   40,   5,  10,   0,   1 },
  { 2,  "Dulce",           0,   10,  15,  -5,   5,   0 },
  { 3,  "Fruta fresca",    0,   25,  10,   5,   0,   1 },
  { 4,  "Pelota",          1,    0,  20,   0, -10,   0 },
  { 5,  "Juguete premium", 1,    0,  30,   0, -15,   1 },
  { 6,  "Medicina",        2,    0,   0,  40,   0,   1 },
  { 7,  "Vitaminas",       2,    0,   5,  25,  10,   1 },
  // Ítems de casa (tipo 4)
  { 8,  "Cama simple",     4,    0,   0,   0,  10,   0 },
  { 9,  "Cama nube",       4,    0,   0,   0,  20,   2 },
  { 10, "Sofa",            4,    0,   5,   0,   0,   0 },
  { 11, "Television",      4,    0,   8,   0,   0,   1 },
  { 12, "Planta",          4,    0,   3,   5,   0,   0 },
  // Ítems de ropa (tipo 3) - placeholder
  { 20, "Sombrero basico", 3,    0,   0,   0,   0,   0 },
  { 21, "Gafas cool",      3,    0,   0,   0,   0,   1 },
  { 22, "Capa espacial",   3,    0,   0,   0,   0,   2 },
  { 23, "Halo brillante",  3,    0,   0,   0,   0,   3 },
};
const uint8_t ITEMS_CATALOG_SIZE = sizeof(ITEMS_CATALOG) / sizeof(Item);

// Precio de tienda por id
static const uint16_t ITEM_PRICES[] = {
  10, 30, 15, 25, 25, 60, 50, 40, // ids 0-7
  80, 200, 60, 100, 40,            // ids 8-12
  0,0,0,0,0,0,0,                   // 13-19 unused
  50, 120, 300, 0                  // ids 20-23 (sobres)
};

GameEngine::GameEngine() {
  _current_screen = Screen::HOUSE;
  _menu_cursor    = 0;
  _shop_cursor    = 0;
  _btn_a_prev = _btn_b_prev = _btn_c_prev = _btn_d_prev = HIGH;
}

void GameEngine::begin(Pet& pet, Display& display, SensorManager& sensors) {
  _pet     = &pet;
  _display = &display;
  _sensors = &sensors;
  _ai.begin("");  // URL de Ollama se configura en WiFiSync
}

// ─── Botones ──────────────────────────────────────────────────────────────────
bool GameEngine::_pressed(bool current, bool& prev) {
  bool edge = (!current && prev); // LOW = presionado (pullup)
  prev = current;
  return edge;
}

void GameEngine::handleButtons(uint8_t pin_a, uint8_t pin_b,
                               uint8_t pin_c, uint8_t pin_d) {
  bool a = digitalRead(pin_a);
  bool b = digitalRead(pin_b);
  bool c = digitalRead(pin_c);
  bool d = digitalRead(pin_d);

  bool pa = _pressed(a, _btn_a_prev);
  bool pb = _pressed(b, _btn_b_prev);
  bool pc = _pressed(c, _btn_c_prev);
  bool pd = _pressed(d, _btn_d_prev);

  switch (_current_screen) {
    case Screen::HOUSE:
      _handleHouseInput(pa, pb, pc, pd);
      break;
    case Screen::MENU:
      _handleMenuInput(pa, pb, pc, pd);
      break;
    case Screen::SHOP:
      _handleShopInput(pa, pb, pc, pd);
      break;
    default: break;
  }
}

void GameEngine::_handleHouseInput(bool a, bool b, bool c, bool d) {
  if (a) {
    // A = abrir menú
    _current_screen = Screen::MENU;
    _menu_cursor = 0;
  }
  if (b) {
    // B = solicitar diálogo IA
    _requestAIDialogue();
  }
}

void GameEngine::_handleMenuInput(bool a, bool b, bool c, bool d) {
  const uint8_t MAX_ITEMS = 8;
  if (c) _menu_cursor = (_menu_cursor + MAX_ITEMS - 1) % MAX_ITEMS; // arriba
  if (d) _menu_cursor = (_menu_cursor + 1) % MAX_ITEMS;              // abajo

  if (a) {
    // Confirmar selección
    switch (_menu_cursor) {
      case 0: _doFeed();       break;
      case 1: _doPlay();       break;
      case 2: _doSleep();      break;
      case 3: _doHeal();       break;
      case 4: _openShop();     break;
      case 5: _openHouse();    break;
      case 6: _openInventory();break;
      case 7: _openCompendium();break;
    }
  }
  if (b) {
    // B = volver a la casa
    _current_screen = Screen::HOUSE;
  }
}

void GameEngine::_handleShopInput(bool a, bool b, bool c, bool d) {
  if (c) _shop_cursor = (_shop_cursor > 0) ? _shop_cursor - 1 : 0;
  if (d) _shop_cursor = (_shop_cursor < 7) ? _shop_cursor + 1 : 7;

  if (a) {
    // Comprar item seleccionado
    uint8_t item_id = _shop_cursor;
    uint16_t price = ITEM_PRICES[item_id];
    if (_pet->coins >= price && _pet->inventory_count < 20) {
      _pet->coins -= price;
      _pet->inventory[_pet->inventory_count++] = ITEMS_CATALOG[item_id];
      _display->showToast("Comprado!");
    } else {
      _display->showToast("Monedas insuf.");
    }
  }
  if (b) _current_screen = Screen::MENU;
}

// ─── Acciones ─────────────────────────────────────────────────────────────────
void GameEngine::_doFeed() {
  // Buscar primer alimento en inventario
  for (int i = 0; i < _pet->inventory_count; i++) {
    if (_pet->inventory[i].type == 0) {
      _pet->feed(_pet->inventory[i]);
      // Eliminar item del inventario
      memmove(&_pet->inventory[i], &_pet->inventory[i+1],
              sizeof(Item) * (_pet->inventory_count - i - 1));
      _pet->inventory_count--;
      _display->showToast("Que rico!");
      _current_screen = Screen::HOUSE;
      return;
    }
  }
  _display->showToast("Sin comida en inventario");
}

void GameEngine::_doPlay() {
  if (_pet->energy < 10) {
    _display->showToast("Muy cansado para jugar");
    return;
  }
  _pet->play();
  _display->showToast("Juego! +felicidad");
  _current_screen = Screen::HOUSE;
}

void GameEngine::_doSleep() {
  if (_pet->is_sleeping) {
    _pet->wake_up();
    _display->showToast("Desperto!");
  } else {
    _pet->sleep_action();
    _display->showToast("A dormir...");
  }
  _current_screen = Screen::HOUSE;
}

void GameEngine::_doHeal() {
  for (int i = 0; i < _pet->inventory_count; i++) {
    if (_pet->inventory[i].type == 2) {
      _pet->heal(_pet->inventory[i]);
      memmove(&_pet->inventory[i], &_pet->inventory[i+1],
              sizeof(Item) * (_pet->inventory_count - i - 1));
      _pet->inventory_count--;
      _display->showToast("Salud recuperada!");
      _current_screen = Screen::HOUSE;
      return;
    }
  }
  _display->showToast("Sin medicina");
}

void GameEngine::_openShop()      { _current_screen = Screen::SHOP;       }
void GameEngine::_openHouse()     { _current_screen = Screen::HOUSE;      }
void GameEngine::_openInventory() { _current_screen = Screen::INVENTORY;  }
void GameEngine::_openCompendium(){ _current_screen = Screen::COMPENDIUM; }

// ─── Tick de decaimiento ──────────────────────────────────────────────────────
void GameEngine::tick(Pet& pet, const SensorManager& sensors) {
  if (!pet.is_alive) return;
  pet.tick(sensors.temperature_c, sensors.humidity_pct, sensors.light_level);

  // Verificar si el pet murió
  if (!pet.is_alive) {
    _storage.appendToCompendium(pet);
    _storage.reset();
    _display->showToast("Tu pet fallecio...");
    _display->flashScreen(TFT_RED, 3);
  }

  // Verificar evolución
  if (pet.checkEvolution()) {
    _display->showDialogue(pet.evolution_key, 5000);
    _display->flashScreen(TFT_YELLOW, 2);
  }
}

void GameEngine::applySensorEffects(Pet& pet, const SensorManager& sensors) {
  // Pasos del dueño
  if (sensors.steps_delta > 0) {
    pet.addOwnerSteps(sensors.steps_delta);
  }

  // Sueño del dueño
  if (sensors.owner_sleeping) {
    pet.onOwnerGoodSleep();
  }

  // Auto-sueño por oscuridad
  if (sensors.isNight() && !pet.is_sleeping) {
    pet.sleep_action();
    _display->showDialogue("Son las noches, a dormir", 3000);
  }
}

// ─── IA Diálogo ──────────────────────────────────────────────────────────────
void GameEngine::_requestAIDialogue() {
  String dialogue = _ai.getDialogue(*_pet);
  if (dialogue.length() > 0) {
    _display->showDialogue(dialogue.c_str(), 5000);
  }
}

// ─── Sonidos ─────────────────────────────────────────────────────────────────
void GameEngine::playSound(uint8_t pin, uint16_t freq, uint16_t duration_ms) {
  tone(pin, freq, duration_ms);
}

void GameEngine::playEvolutionSound(uint8_t pin) {
  uint16_t notes[] = { 262, 330, 392, 523 };
  for (int i = 0; i < 4; i++) {
    tone(pin, notes[i], 200);
    delay(220);
  }
}

void GameEngine::playEpicItemSound(uint8_t pin) {
  uint16_t notes[] = { 523, 659, 784, 1047 };
  for (int i = 0; i < 4; i++) {
    tone(pin, notes[i], 150);
    delay(160);
  }
}

// ─── Creación de nuevo pet ───────────────────────────────────────────────────
void GameEngine::createNewPet(Pet& pet, Display& display) {
  // Mostrar selección de nombre (simplificado: nombre por defecto)
  // En versión final: teclado en TFT para escribir nombre
  strcpy(pet.name, "Tama");

  // Selección de especie con botones
  display.tft.fillScreen(TFT_BLACK);
  display.tft.setTextColor(TFT_WHITE);
  display.tft.setTextDatum(MC_DATUM);
  display.tft.setTextSize(1);

  const char* species_names[] = { "FUEGO", "AGUA", "PLANTA", "ELECTRICO" };
  const uint16_t species_colors[] = { 0xFBA0, 0x041F, 0x07E0, 0xFFE0 };
  uint8_t selected = 0;
  bool confirmed = false;

  while (!confirmed) {
    display.tft.fillScreen(TFT_BLACK);
    display.tft.drawString("Elige tu especie:", 120, 40);
    for (int i = 0; i < 4; i++) {
      uint16_t color = (i == selected) ? species_colors[i] : TFT_DARKGREY;
      display.tft.setTextColor(color);
      display.tft.drawString(species_names[i], 120, 80 + i * 40);
    }
    if (i == selected) {
      display.tft.drawString(">", 40, 80 + selected * 40);
    }

    delay(100);

    if (!digitalRead(39)) {  // D = abajo
      selected = (selected + 1) % 4;
      delay(200);
    }
    if (!digitalRead(34)) {  // C = arriba
      selected = (selected + 3) % 4;
      delay(200);
    }
    if (!digitalRead(0)) {  // A = confirmar
      confirmed = true;
      delay(200);
    }
  }

  // Asignar especie
  pet.species = (Species)selected;
  pet.stage   = Stage::EGG;
  pet.birth_timestamp = millis();
  pet.is_alive = true;

  // Generar personalidad única
  uint32_t seed = millis() ^ (millis() << 13) ^ analogRead(36);
  pet.traits = PersonalityGen::generate(pet.species, seed);

  // Computar clave de evolución inicial
  pet.computeEvolutionKey();

  // Guardar
  _storage.save(pet);

  display.showDialogue("Tu nuevo pet ha nacido!", 3000);
}
