#pragma once
#include <Arduino.h>
#include <TFT_eSPI.h>
#include "Pet.h"
#include "Sprites.h"

/*
 * Pantallas del juego
 */
enum class Screen : uint8_t {
  HOUSE   = 0,   // Pantalla principal: casa del pet + stats
  MENU    = 1,   // Menú de acciones
  SHOP    = 2,   // Tienda
  INVENTORY=3,   // Inventario y armario
  MINIGAME= 4,   // Mini-juego activo
  COMPENDIUM=5,  // Historial de pets
  MEMORIES= 6,   // Bitácora del pet actual
  PACK_OPEN=7,   // Animación apertura de sobre
  LEADERBOARD=8  // Ranking social
};

/*
 * Display – Manager de la pantalla TFT
 * Usa TFT_eSPI con doble buffer (sprite) para evitar parpadeo
 */
class Display {
public:
  TFT_eSPI tft;
  TFT_eSprite canvas;   // buffer de pantalla completa

  Display();
  void begin();

  // Pantalla de bienvenida
  void showSplash();

  // Render principal: dibuja la pantalla actual
  void render(const Pet& pet, Screen screen);

  // Burbuja de diálogo en pantalla
  void showDialogue(const char* text, uint16_t duration_ms);

  // Notificación toast (barra inferior)
  void showToast(const char* text, uint16_t color = TFT_WHITE);

  // Efectos especiales
  void flashScreen(uint16_t color, uint8_t times); // para ítems épicos

private:
  // ── Renders por pantalla ──────────────────────────────────────────────────
  void _renderHouse(const Pet& pet);
  void _renderMenu(const Pet& pet);
  void _renderShop();
  void _renderInventory(const Pet& pet);
  void _renderCompendium();
  void _renderMemories(const Pet& pet);

  // ── Componentes visuales ─────────────────────────────────────────────────
  void _drawStatBars(const Pet& pet, int16_t x, int16_t y);
  void _drawHouseBackground(const Pet& pet);
  void _drawPetSprite(const Pet& pet, int16_t x, int16_t y);
  void _drawWeatherIcon(uint8_t icon, int16_t x, int16_t y);
  void _drawCoinCounter(uint16_t coins, int16_t x, int16_t y);
  void _drawStepBar(uint32_t steps, int16_t x, int16_t y);

  // ── Helpers TFT ──────────────────────────────────────────────────────────
  // Dibuja un sprite PROGMEM con transparencia (color 0xF81F = transparente)
  void _drawSprite(const uint16_t* sprite_pgm, int16_t x, int16_t y,
                   uint8_t w, uint8_t h, uint16_t tint = 0xFFFF);

  // Barra de stat coloreada
  void _drawBar(int16_t x, int16_t y, int16_t w, int16_t h,
                uint8_t value, uint16_t color_full, uint16_t color_empty);

  // Texto centrado
  void _drawCentered(const char* text, int16_t y, uint8_t font, uint16_t color);

  // Estado de animación del pet (idle/jump/sleep)
  uint8_t   _anim_frame;
  uint32_t  _anim_timer;

  // Toast
  char      _toast_text[32];
  uint32_t  _toast_until;

  // Diálogo
  char      _dialogue_text[60];
  uint32_t  _dialogue_until;
};
