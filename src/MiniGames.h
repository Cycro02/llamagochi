#pragma once
#include <Arduino.h>
#include "Pet.h"
#include "Display.h"

/*
 * MiniGames – 3 mini-juegos controlados por botones
 *
 * 1. Secuencia Relampago (Simon Says) – repite secuencias de botones
 * 2. Reaccion Rapida – presiona el botón correcto en < 500ms
 * 3. Adivina el Numero – adivina 1-10 con botones arriba/abajo
 *
 * Límite: 5 juegos por día (guardado en Pet.games_played_today)
 * Recompensas: coins + stat bonus según rendimiento
 */
class MiniGames {
public:
  MiniGames();
  void begin(Display* display, uint8_t pin_a, uint8_t pin_b,
             uint8_t pin_c, uint8_t pin_d, uint8_t pin_buzzer);

  // Inicia un mini-juego. Retorna monedas ganadas (0 si límite alcanzado)
  uint16_t playSimon(Pet& pet);
  uint16_t playReaction(Pet& pet);
  uint16_t playGuessNumber(Pet& pet);

  // Verifica y actualiza límite diario
  bool canPlay(const Pet& pet) const;

private:
  Display*  _display;
  uint8_t   _pin_a, _pin_b, _pin_c, _pin_d, _pin_buzzer;

  bool _waitButton(uint8_t pin, uint32_t timeout_ms) const;
  uint8_t _waitAnyButton(uint32_t timeout_ms) const;

  // Notas del buzzer para feedback
  void _beep(uint16_t freq, uint16_t ms);
  void _beepError();
  void _beepSuccess();
};
