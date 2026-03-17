#pragma once
#include <Arduino.h>
#include "Pet.h"
#include "Display.h"
#include "Sensors.h"
#include "Personality.h"
#include "Storage.h"

// Items predefinidos del juego
extern const Item ITEMS_CATALOG[];
extern const uint8_t ITEMS_CATALOG_SIZE;

/*
 * GameEngine – Controlador principal del juego
 * Maneja: botones, navegación de menús, acciones, creación de pet
 */
class GameEngine {
public:
  GameEngine();

  void begin(Pet& pet, Display& display, SensorManager& sensors);

  // Procesar botones (llamar cada frame)
  void handleButtons(uint8_t pin_a, uint8_t pin_b, uint8_t pin_c, uint8_t pin_d);

  // Tick de decaimiento de stats (llamar cada 10 min)
  void tick(Pet& pet, const SensorManager& sensors);

  // Aplicar efectos de sensores sobre el pet
  void applySensorEffects(Pet& pet, const SensorManager& sensors);

  // Pantalla activa
  Screen getCurrentScreen() const { return _current_screen; }

  // Wizard de creación de nuevo pet
  void createNewPet(Pet& pet, Display& display);

  // Buzzer
  void playSound(uint8_t pin_buzzer, uint16_t freq, uint16_t duration_ms);
  void playEvolutionSound(uint8_t pin_buzzer);
  void playEpicItemSound(uint8_t pin_buzzer);

private:
  Pet*          _pet;
  Display*      _display;
  SensorManager*_sensors;
  Storage       _storage;
  PersonalityAI _ai;

  Screen  _current_screen;
  uint8_t _menu_cursor;     // posición del cursor en el menú
  uint8_t _shop_cursor;
  bool    _btn_a_prev, _btn_b_prev, _btn_c_prev, _btn_d_prev;

  // ── Acciones del menú ────────────────────────────────────────────────────
  void _doFeed();
  void _doPlay();
  void _doSleep();
  void _doHeal();
  void _openShop();
  void _openHouse();
  void _openInventory();
  void _openCompendium();

  // ── Lógica interna ───────────────────────────────────────────────────────
  void _handleMenuInput(bool a, bool b, bool c, bool d);
  void _handleHouseInput(bool a, bool b, bool c, bool d);
  void _handleShopInput(bool a, bool b, bool c, bool d);
  void _requestAIDialogue();

  // ── Detección de flancos de botón ────────────────────────────────────────
  bool _pressed(bool current, bool& prev);
};
