#pragma once
#include <Arduino.h>
#include "Pet.h"
#include "Display.h"

/*
 * WardrobeSystem – Sistema de ropa y sobres tipo Pokémon
 *
 * Sobres:
 *   Común (50c)  → 3 ítems comunes + 1 poco común
 *   Raro (150c)  → 2 poco comunes + 1 raro
 *   Épico (400c) → 1 raro + 1 épico garantizado
 *   Evento       → ítems exclusivos desde el servidor
 *
 * Raridades: 0=común, 1=poco común, 2=raro, 3=épico
 */

enum class PackType : uint8_t {
  COMMON = 0,
  RARE   = 1,
  EPIC   = 2,
  EVENT  = 3
};

// Todos los ítems de ropa/accesorio disponibles
struct WardrobeItem {
  uint8_t  id;
  char     name[24];
  uint8_t  slot;     // 0=sombrero, 1=camisa, 2=pantalon, 3=zapatos, 4=accesorio
  uint8_t  rarity;
  bool     animated; // ítems épicos tienen animación
};

class WardrobeSystem {
public:
  WardrobeSystem();

  // Abrir un sobre y dar items al pet
  // Retorna true si se obtuvo un ítem épico
  bool openPack(Pet& pet, Display& display, PackType type, uint8_t pin_buzzer = 255);

  // Equipar ítem del inventario
  bool equip(Pet& pet, uint8_t item_id);

  // Desequipar slot
  void unequip(Pet& pet, uint8_t slot);

  // Catálogo completo de ítems de ropa
  static const WardrobeItem CATALOG[];
  static const uint8_t CATALOG_SIZE;

private:
  // Genera items del sobre según tipo y seed
  void _generatePackItems(PackType type, uint32_t seed,
                          uint8_t* out_ids, uint8_t& count);

  // Animación de apertura de sobre en TFT
  bool _playOpenAnimation(Display& display, const uint8_t* item_ids,
                          uint8_t count, uint8_t pin_buzzer);

  // Obtiene ítem aleatorio por rareza mínima
  uint8_t _randomItemOfRarity(uint8_t min_rarity, uint32_t seed);
};
