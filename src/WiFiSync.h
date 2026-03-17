#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "Pet.h"

class GameEngine;

/*
 * WiFiSync – Gestiona WiFi, sincronización con el servidor social y Ollama
 *
 * Funciones:
 *   - Conexión WiFi asíncrona (no-blocking)
 *   - Sync del pet al leaderboard del servidor
 *   - Descarga de regalos pendientes
 *   - Eventos temporales del servidor (Halloween, Navidad, etc.)
 *   - Configurar URL de Ollama para PersonalityAI
 */
class WiFiSync {
public:
  WiFiSync();

  // Inicia conexión WiFi en background (no bloquea setup)
  void beginAsync(const char* ssid, const char* password,
                  const char* ollama_host, const char* server_host);

  // Sincroniza pet al servidor (leaderboard)
  bool syncPet(const Pet& pet);

  // Descarga regalos pendientes del servidor y los aplica al pet
  bool checkGifts(Pet& pet, GameEngine& engine);

  // Descarga evento temporal actual del servidor
  bool checkSeasonalEvent(Pet& pet);

  // URL del servidor para uso en VoiceCmd
  const char* getServerHost() const { return _server_host; }

  // URL de Ollama
  const char* getOllamaHost() const { return _ollama_host; }

  bool isConnected() const { return WiFi.status() == WL_CONNECTED; }

private:
  char _ssid[32];
  char _password[64];
  char _ollama_host[64];
  char _server_host[64];

  bool _post(const char* url, const String& body, String& response);
  bool _get(const char* url, String& response);
};
