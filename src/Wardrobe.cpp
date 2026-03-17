#include "Wardrobe.h"

// ─── Catálogo de ropa ─────────────────────────────────────────────────────────
const WardrobeItem WardrobeSystem::CATALOG[] = {
  // id  name               slot  rarity  animated
  // ─── Sombreros (slot 0)
  { 50, "Gorra basica",      0,    0,    false },
  { 51, "Sombrero vaquero",  0,    0,    false },
  { 52, "Beanie rayado",     0,    0,    false },
  { 53, "Sombrero mago",     0,    1,    false },
  { 54, "Corona real",       0,    2,    false },
  { 55, "Halo dorado",       0,    3,    true  },
  // ─── Camisas (slot 1)
  { 60, "Camiseta blanca",   1,    0,    false },
  { 61, "Jersey deportivo",  1,    0,    false },
  { 62, "Camisa hawaiana",   1,    1,    false },
  { 63, "Traje espacial",    1,    2,    false },
  { 64, "Armadura ninja",    1,    2,    false },
  { 65, "Capa de heroe",     1,    3,    true  },
  // ─── Pantalones (slot 2)
  { 70, "Jeans basicos",     2,    0,    false },
  { 71, "Shorts playa",      2,    0,    false },
  { 72, "Pantalon samurai",  2,    1,    false },
  { 73, "Pantalon espacial", 2,    2,    false },
  // ─── Zapatos (slot 3)
  { 80, "Zapatos blancos",   3,    0,    false },
  { 81, "Botas aventura",    3,    1,    false },
  { 82, "Zapatillas neon",   3,    1,    false },
  { 83, "Botas magicas",     3,    3,    true  },
  // ─── Accesorios (slot 4)
  { 90, "Mochila simple",    4,    0,    false },
  { 91, "Gafas de sol",      4,    0,    false },
  { 92, "Bufanda colorida",  4,    1,    false },
  { 93, "Alas de angel",     4,    3,    true  },
  { 94, "Alas de dragon",    4,    3,    true  },
};
const uint8_t WardrobeSystem::CATALOG_SIZE = sizeof(WardrobeSystem::CATALOG) / sizeof(WardrobeItem);

WardrobeSystem::WardrobeSystem() {}

// ─── Abrir sobre ─────────────────────────────────────────────────────────────
bool WardrobeSystem::openPack(Pet& pet, Display& display, PackType type, uint8_t pin_buzzer) {
  uint16_t cost = 0;
  switch (type) {
    case PackType::COMMON: cost = 50;  break;
    case PackType::RARE:   cost = 150; break;
    case PackType::EPIC:   cost = 400; break;
    case PackType::EVENT:  cost = 0;   break;
  }

  if (pet.coins < cost) {
    display.showToast("Monedas insuficientes");
    return false;
  }
  pet.coins -= cost;

  // Generar items
  uint8_t item_ids[4];
  uint8_t item_count = 0;
  uint32_t seed = millis() ^ pet.coins ^ (uint32_t)pet.name[0];
  _generatePackItems(type, seed, item_ids, item_count);

  // Animación de apertura
  bool has_epic = _playOpenAnimation(display, item_ids, item_count, pin_buzzer);

  // Agregar items al inventario del pet
  for (int i = 0; i < item_count; i++) {
    if (pet.inventory_count >= 20) break;
    // Buscar ítem en catálogo
    for (int j = 0; j < CATALOG_SIZE; j++) {
      if (CATALOG[j].id == item_ids[i]) {
        Item item;
        item.id     = CATALOG[j].id;
        strlcpy(item.name, CATALOG[j].name, sizeof(item.name));
        item.type   = 3; // ropa
        item.rarity = CATALOG[j].rarity;
        item.hunger_fx = item.happiness_fx = item.health_fx = item.energy_fx = 0;
        pet.inventory[pet.inventory_count++] = item;
        break;
      }
    }
  }

  pet.addMemory("Abrio un sobre!");
  return has_epic;
}

void WardrobeSystem::_generatePackItems(PackType type, uint32_t seed,
                                        uint8_t* out_ids, uint8_t& count) {
  count = 0;
  auto rnd = [&](uint32_t max) -> uint32_t {
    seed = seed * 1664525UL + 1013904223UL;
    return seed % max;
  };

  switch (type) {
    case PackType::COMMON:
      // 3 comunes + 1 poco común
      out_ids[count++] = _randomItemOfRarity(0, rnd(0xFFFF));
      out_ids[count++] = _randomItemOfRarity(0, rnd(0xFFFF));
      out_ids[count++] = _randomItemOfRarity(0, rnd(0xFFFF));
      out_ids[count++] = _randomItemOfRarity(1, rnd(0xFFFF));
      break;
    case PackType::RARE:
      // 2 poco comunes + 1 raro
      out_ids[count++] = _randomItemOfRarity(1, rnd(0xFFFF));
      out_ids[count++] = _randomItemOfRarity(1, rnd(0xFFFF));
      out_ids[count++] = _randomItemOfRarity(2, rnd(0xFFFF));
      break;
    case PackType::EPIC:
      // 1 raro + 1 épico
      out_ids[count++] = _randomItemOfRarity(2, rnd(0xFFFF));
      out_ids[count++] = _randomItemOfRarity(3, rnd(0xFFFF));
      break;
    case PackType::EVENT:
      // 2 ítems raros de evento
      out_ids[count++] = _randomItemOfRarity(2, rnd(0xFFFF));
      out_ids[count++] = _randomItemOfRarity(2, rnd(0xFFFF));
      break;
  }
}

uint8_t WardrobeSystem::_randomItemOfRarity(uint8_t min_rarity, uint32_t seed) {
  // Recopilar todos los ítems de rareza >= min_rarity
  uint8_t candidates[25];
  uint8_t n = 0;
  for (int i = 0; i < CATALOG_SIZE; i++) {
    if (CATALOG[i].rarity >= min_rarity) {
      candidates[n++] = CATALOG[i].id;
    }
  }
  if (n == 0) return CATALOG[0].id;
  return candidates[seed % n];
}

// ─── Animación de apertura ────────────────────────────────────────────────────
bool WardrobeSystem::_playOpenAnimation(Display& display, const uint8_t* item_ids,
                                        uint8_t count, uint8_t pin_buzzer) {
  bool has_epic = false;

  // Fondo de apertura
  display.tft.fillScreen(TFT_BLACK);
  display.tft.setTextColor(TFT_YELLOW);
  display.tft.setTextDatum(MC_DATUM);
  display.tft.setTextSize(2);
  display.tft.drawString("ABRIENDO SOBRE", 120, 40);
  delay(800);

  for (int i = 0; i < count; i++) {
    // Mostrar tarjeta volteándose
    display.tft.fillScreen(0x0821);

    // Animación: tarjeta aparece de izquierda a derecha
    for (int w = 0; w <= 160; w += 20) {
      display.tft.fillRect(40, 100, w, 120, TFT_DARKGREY);
      delay(30);
    }

    // Buscar ítem en catálogo
    const WardrobeItem* found = nullptr;
    for (int j = 0; j < CATALOG_SIZE; j++) {
      if (CATALOG[j].id == item_ids[i]) {
        found = &CATALOG[j];
        break;
      }
    }

    if (found) {
      // Color de borde según rareza
      const uint16_t rarity_colors[] = {
        TFT_SILVER, TFT_GREEN, TFT_BLUE, TFT_GOLD
      };
      uint16_t border = rarity_colors[min(found->rarity, (uint8_t)3)];

      // Borde de rareza
      display.tft.drawRect(40, 100, 160, 120, border);
      display.tft.drawRect(41, 101, 158, 118, border);

      // Nombre del ítem
      display.tft.setTextColor(TFT_WHITE);
      display.tft.setTextSize(1);
      display.tft.drawString(found->name, 120, 150);

      // Rareza
      const char* rarity_names[] = { "Comun", "Poco Comun", "Raro", "EPICO" };
      display.tft.setTextColor(border);
      display.tft.drawString(rarity_names[found->rarity], 120, 175);

      if (found->rarity == 3) {
        has_epic = true;
        // Efecto especial para épico
        display.flashScreen(TFT_GOLD, 3);
        if (pin_buzzer != 255) {
          // Melodía épica
          uint16_t notes[] = { 523, 659, 784, 1047, 1319 };
          for (int n = 0; n < 5; n++) {
            tone(pin_buzzer, notes[n], 150);
            delay(160);
          }
        }
      } else {
        // Sonido normal
        if (pin_buzzer != 255) tone(pin_buzzer, 440, 100);
      }
    }

    delay(1500);
  }

  display.tft.fillScreen(TFT_BLACK);
  return has_epic;
}

// ─── Equipar / Desequipar ────────────────────────────────────────────────────
bool WardrobeSystem::equip(Pet& pet, uint8_t item_id) {
  for (int j = 0; j < CATALOG_SIZE; j++) {
    if (CATALOG[j].id == item_id) {
      switch (CATALOG[j].slot) {
        case 0: pet.wardrobe.hat_id       = item_id; break;
        case 1: pet.wardrobe.shirt_id     = item_id; break;
        case 2: pet.wardrobe.pants_id     = item_id; break;
        case 3: pet.wardrobe.shoes_id     = item_id; break;
        case 4: pet.wardrobe.accessory_id = item_id; break;
      }
      return true;
    }
  }
  return false;
}

void WardrobeSystem::unequip(Pet& pet, uint8_t slot) {
  switch (slot) {
    case 0: pet.wardrobe.hat_id       = -1; break;
    case 1: pet.wardrobe.shirt_id     = -1; break;
    case 2: pet.wardrobe.pants_id     = -1; break;
    case 3: pet.wardrobe.shoes_id     = -1; break;
    case 4: pet.wardrobe.accessory_id = -1; break;
  }
}
