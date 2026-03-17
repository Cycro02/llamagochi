#include "VoiceCmd.h"
#include "GameEngine.h"
#include "WiFiSync.h"
#include <WiFi.h>
#include <HTTPClient.h>

VoiceCmd::VoiceCmd() {
  _i2s_port   = I2S_NUM_1;
  _btn_prev   = HIGH;
  _i2s_ready  = false;
  _audio_buffer = nullptr;
}

void VoiceCmd::begin(uint8_t pin_sck, uint8_t pin_ws, uint8_t pin_sd,
                     uint8_t pin_btn_voice) {
  _pin_btn_voice = pin_btn_voice;
  pinMode(pin_btn_voice, INPUT_PULLUP);

  // Configurar I2S para INMP441
  i2s_config_t cfg = {
    .mode               = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate        = SAMPLE_RATE,
    .bits_per_sample    = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format     = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags   = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count      = 4,
    .dma_buf_len        = 512,
    .use_apll           = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk         = 0
  };

  i2s_pin_config_t pins = {
    .bck_io_num   = pin_sck,
    .ws_io_num    = pin_ws,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = pin_sd
  };

  esp_err_t err = i2s_driver_install(_i2s_port, &cfg, 0, nullptr);
  if (err == ESP_OK) {
    i2s_set_pin(_i2s_port, &pins);
    i2s_zero_dma_buffer(_i2s_port);
    _i2s_ready = true;
  }

  // Alocar buffer de audio en PSRAM si disponible, sino en heap
  _audio_buffer = (int16_t*)malloc(BUFFER_WORDS * sizeof(int16_t));
}

// ─── Loop de procesamiento ────────────────────────────────────────────────────
void VoiceCmd::process(Pet& pet, GameEngine& engine, WiFiSync& wifi) {
  if (!_i2s_ready || !_audio_buffer) return;

  bool btn_now = digitalRead(_pin_btn_voice);
  bool pressed = (!btn_now && _btn_prev); // flanco
  _btn_prev = btn_now;

  // Modo siempre: detectar nivel de sonido (reacción pasiva)
  float volume = getSoundLevel();
  if (volume > 0.6f) {
    _reactToSound(pet, engine, volume);
  }

  // Si se presionó el botón de voz
  if (!pressed) return;

  if (WiFi.status() == WL_CONNECTED) {
    // Modo con WiFi: grabar y transcribir
    if (_record()) {
      String server_url = String(wifi.getServerHost()) + "/api/voice/transcribe";
      String text = _transcribeViaServer(server_url.c_str());

      if (text.length() > 0) {
        uint8_t cmd = _parseCommand(text, pet.name);
        switch (cmd) {
          case 0: // nombre del pet
            pet.happiness = (uint8_t)min(100, (int)pet.happiness + 5);
            pet.addMemory("Duenio me llamo por mi nombre!");
            engine.playSound(25, 880, 200);
            break;
          case 1: engine._doFeed();  break; // come
          case 2: engine._doPlay();  break; // juega
          case 3: engine._doSleep(); break; // duerme
          // casa y tienda → cambiar pantalla
          default: break;
        }
      }
    }
  } else {
    // Modo sin WiFi: solo detectar intensidad
    _reactToSound(pet, engine, volume);
  }
}

// ─── Grabación de audio ───────────────────────────────────────────────────────
bool VoiceCmd::_record() {
  if (!_i2s_ready || !_audio_buffer) return false;

  size_t bytes_read = 0;
  size_t total_read = 0;
  size_t needed = BUFFER_WORDS * sizeof(int16_t);

  while (total_read < needed) {
    i2s_read(_i2s_port, (char*)_audio_buffer + total_read,
             needed - total_read, &bytes_read, portMAX_DELAY);
    total_read += bytes_read;
  }
  return total_read == needed;
}

float VoiceCmd::getSoundLevel() {
  if (!_i2s_ready) return 0.0f;

  int16_t sample;
  size_t bytes_read;
  float max_val = 0.0f;

  for (int i = 0; i < 64; i++) {
    i2s_read(_i2s_port, &sample, 2, &bytes_read, 10 / portTICK_PERIOD_MS);
    float abs_val = fabsf((float)sample / 32768.0f);
    if (abs_val > max_val) max_val = abs_val;
  }
  return max_val;
}

// ─── Transcripción via servidor (Whisper) ────────────────────────────────────
String VoiceCmd::_transcribeViaServer(const char* url) {
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/octet-stream");
  http.setTimeout(10000);

  // Enviar audio raw PCM 16kHz 16bit mono
  int code = http.POST((uint8_t*)_audio_buffer, BUFFER_WORDS * sizeof(int16_t));
  if (code != 200) { http.end(); return ""; }

  String response = http.getString();
  http.end();
  return response; // servidor devuelve texto plano
}

// ─── Mapear texto a comando ───────────────────────────────────────────────────
uint8_t VoiceCmd::_parseCommand(const String& text, const char* pet_name) const {
  String lower = text;
  lower.toLowerCase();

  if (lower.indexOf(String(pet_name).toLowerCase()) >= 0) return 0;
  if (lower.indexOf("come")  >= 0 || lower.indexOf("comer") >= 0) return 1;
  if (lower.indexOf("juega") >= 0 || lower.indexOf("jugar") >= 0) return 2;
  if (lower.indexOf("duerme")>= 0 || lower.indexOf("dormir")>= 0) return 3;
  if (lower.indexOf("casa")  >= 0)                                  return 4;
  if (lower.indexOf("tienda")>= 0)                                  return 5;
  return 255; // sin comando
}

// ─── Reacción pasiva al sonido ───────────────────────────────────────────────
void VoiceCmd::_reactToSound(Pet& pet, GameEngine& engine, float volume) {
  // Solo reacciona ocasionalmente para no saturar
  static uint32_t last_react = 0;
  if (millis() - last_react < 5000) return;
  last_react = millis();

  if (volume > 0.8f) {
    // Sonido muy alto: el pet se asusta
    pet.happiness = (uint8_t)max(0, (int)pet.happiness - 3);
  } else if (volume > 0.4f) {
    // Voz normal: el pet se alegra (alguien le está hablando)
    pet.happiness = (uint8_t)min(100, (int)pet.happiness + 1);
  }
}
