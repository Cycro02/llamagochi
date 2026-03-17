/*
 * Tamagotchi Next Level - ESP32
 *
 * Hardware:
 *   - ESP32 (240MHz, 520KB RAM, 4MB Flash)
 *   - TFT ILI9341/ST7789 240x320 (SPI)
 *   - 4x Botones (A=acción, B=menú, C=arriba, D=abajo)
 *   - DHT22 (temperatura/humedad)
 *   - LDR (sensor de luz)
 *   - MPU-6050 (acelerómetro - pasos del dueño)
 *   - INMP441 (micrófono I2S)
 *   - Piezo buzzer
 *   - LiPo 500mAh + TP4056
 *
 * Librerías requeridas:
 *   - TFT_eSPI
 *   - ArduinoJson
 *   - DHT sensor library (Adafruit)
 *   - MPU6050 (Electronic Cats)
 *   - LittleFS
 */

#include <Arduino.h>
#include <WiFi.h>
#include <LittleFS.h>
#include "src/Pet.h"
#include "src/Display.h"
#include "src/GameEngine.h"
#include "src/Sensors.h"
#include "src/Storage.h"
#include "src/WiFiSync.h"
#include "src/VoiceCmd.h"
#include "src/Personality.h"

// ─── Configuración WiFi ─────────────────────────────────────────────────────
#define WIFI_SSID     "TU_RED_WIFI"
#define WIFI_PASSWORD "TU_PASSWORD"
#define OLLAMA_HOST   "http://192.168.1.100:11434"  // IP de tu PC con Ollama
#define SERVER_HOST   "http://192.168.1.100:3000"   // IP del backend social

// ─── Pines ──────────────────────────────────────────────────────────────────
#define PIN_BTN_A    0   // Acción / Confirmar
#define PIN_BTN_B    35  // Menú / Cancelar
#define PIN_BTN_C    34  // Arriba
#define PIN_BTN_D    39  // Abajo

#define PIN_DHT22    4
#define PIN_LDR      36  // ADC1_0 (analógico)
#define PIN_BUZZER   25

// I2C para MPU-6050
#define PIN_SDA      21
#define PIN_SCL      22

// I2S para INMP441
#define PIN_I2S_SCK  26
#define PIN_I2S_WS   27
#define PIN_I2S_SD   14

// ─── Objetos globales ────────────────────────────────────────────────────────
Pet          pet;
Display      display;
GameEngine   engine;
SensorManager sensors;
Storage      storage;
WiFiSync     wifi_sync;
VoiceCmd     voice;

// ─── Intervalos ─────────────────────────────────────────────────────────────
#define TICK_INTERVAL_MS     600000UL   // 10 minutos → decaimiento de stats
#define SENSOR_INTERVAL_MS    30000UL   // 30 seg → lectura de sensores
#define SYNC_INTERVAL_MS    3600000UL   // 1 hora → sync al servidor
#define SAVE_INTERVAL_MS     300000UL   // 5 min → guardar en flash

uint32_t lastTick    = 0;
uint32_t lastSensor  = 0;
uint32_t lastSync    = 0;
uint32_t lastSave    = 0;

// ─── Setup ──────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Inicializar LittleFS
  if (!LittleFS.begin(true)) {
    Serial.println("ERROR: LittleFS mount failed");
    return;
  }

  // Inicializar botones
  pinMode(PIN_BTN_A, INPUT_PULLUP);
  pinMode(PIN_BTN_B, INPUT_PULLUP);
  pinMode(PIN_BTN_C, INPUT_PULLUP);
  pinMode(PIN_BTN_D, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);

  // Inicializar pantalla TFT
  display.begin();
  display.showSplash();

  // Cargar pet guardado o crear uno nuevo
  if (!storage.load(pet)) {
    engine.createNewPet(pet, display);
  }

  // Inicializar sensores
  sensors.begin(PIN_DHT22, PIN_LDR, PIN_SDA, PIN_SCL,
                PIN_I2S_SCK, PIN_I2S_WS, PIN_I2S_SD);

  // Conectar WiFi (no-blocking)
  wifi_sync.beginAsync(WIFI_SSID, WIFI_PASSWORD, OLLAMA_HOST, SERVER_HOST);

  // Iniciar motor del juego
  engine.begin(pet, display, sensors);

  Serial.println("Tamagotchi listo!");
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  uint32_t now = millis();

  // Leer botones y ejecutar acciones
  engine.handleButtons(PIN_BTN_A, PIN_BTN_B, PIN_BTN_C, PIN_BTN_D);

  // Reconocimiento de voz (detecta si botón voz está presionado)
  voice.process(pet, engine, wifi_sync);

  // Decaimiento de stats cada 10 minutos
  if (now - lastTick >= TICK_INTERVAL_MS) {
    engine.tick(pet, sensors);
    lastTick = now;
  }

  // Lectura de sensores cada 30 segundos
  if (now - lastSensor >= SENSOR_INTERVAL_MS) {
    sensors.read();
    engine.applySensorEffects(pet, sensors);
    lastSensor = now;
  }

  // Guardar en flash cada 5 minutos
  if (now - lastSave >= SAVE_INTERVAL_MS) {
    storage.save(pet);
    lastSave = now;
  }

  // Sync al servidor cada hora (si hay WiFi)
  if (now - lastSync >= SYNC_INTERVAL_MS) {
    wifi_sync.syncPet(pet);
    wifi_sync.checkGifts(pet, engine);
    lastSync = now;
  }

  // Actualizar pantalla
  display.render(pet, engine.getCurrentScreen());

  delay(50); // ~20 FPS
}
