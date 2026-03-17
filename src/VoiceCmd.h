#pragma once
#include <Arduino.h>
#include <driver/i2s.h>
#include "Pet.h"

// Forward declarations
class GameEngine;
class WiFiSync;

/*
 * VoiceCmd – Reconocimiento de voz via INMP441 (I2S)
 *
 * Flujo:
 *   1. Presionar botón de voz → graba 1.5s de audio
 *   2. Si WiFi disponible: envía audio al servidor (Whisper STT)
 *      El servidor devuelve el comando detectado
 *   3. Si sin WiFi: detecta intensidad de voz (el pet reacciona al sonido)
 *
 * Comandos soportados:
 *   [nombre_pet], "come", "juega", "duerme", "casa", "tienda"
 */
class VoiceCmd {
public:
  VoiceCmd();

  void begin(uint8_t pin_sck, uint8_t pin_ws, uint8_t pin_sd,
             uint8_t pin_btn_voice);

  // Procesar voz: llamar en el loop principal
  // Detecta si se presiona el botón y ejecuta el comando correspondiente
  void process(Pet& pet, GameEngine& engine, WiFiSync& wifi);

  // Detectar nivel de sonido (para modo offline)
  float getSoundLevel();

private:
  i2s_port_t  _i2s_port;
  uint8_t     _pin_btn_voice;
  bool        _btn_prev;
  bool        _i2s_ready;

  // Buffer de audio (1.5 segundos a 16kHz, 16bit mono)
  static const int SAMPLE_RATE   = 16000;
  static const int RECORD_SECS   = 2;
  static const int BUFFER_WORDS  = SAMPLE_RATE * RECORD_SECS;
  int16_t* _audio_buffer;

  // Graba audio del micrófono I2S
  bool _record();

  // Envía audio al servidor para Whisper STT
  String _transcribeViaServer(const char* server_url);

  // Mapea texto transcrito a comando
  uint8_t _parseCommand(const String& text, const char* pet_name) const;

  // Reacción offline (solo detección de volumen)
  void _reactToSound(Pet& pet, GameEngine& engine, float volume);
};
