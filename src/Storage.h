#pragma once
#include <Arduino.h>
#include "Pet.h"

/*
 * Storage – Persistencia del pet en LittleFS (flash del ESP32)
 * Guarda y carga el estado completo del pet en formato JSON
 */
class Storage {
public:
  // Carga pet desde /pet.json → devuelve true si existe y es válido
  bool load(Pet& pet);

  // Guarda pet en /pet.json
  bool save(const Pet& pet);

  // Elimina el archivo de pet (para empezar de nuevo)
  void reset();

  // Guarda compendio de pets anteriores
  bool appendToCompendium(const Pet& pet);

  // Carga historial del compendio (JSON array)
  String loadCompendium();
};
