#include "WiFiSync.h"
#include "GameEngine.h"
#include <ArduinoJson.h>

WiFiSync::WiFiSync() {
  memset(_ssid,        0, sizeof(_ssid));
  memset(_password,    0, sizeof(_password));
  memset(_ollama_host, 0, sizeof(_ollama_host));
  memset(_server_host, 0, sizeof(_server_host));
}

void WiFiSync::beginAsync(const char* ssid, const char* password,
                          const char* ollama_host, const char* server_host) {
  strlcpy(_ssid,        ssid,        sizeof(_ssid));
  strlcpy(_password,    password,    sizeof(_password));
  strlcpy(_ollama_host, ollama_host, sizeof(_ollama_host));
  strlcpy(_server_host, server_host, sizeof(_server_host));

  WiFi.mode(WIFI_STA);
  WiFi.begin(_ssid, _password);
  // No esperamos – el sistema sigue funcionando sin WiFi
  Serial.println("WiFi: conectando en background...");
}

bool WiFiSync::syncPet(const Pet& pet) {
  if (!isConnected()) return false;

  StaticJsonDocument<256> doc;
  doc["device_id"] = WiFi.macAddress();
  doc["pet_name"]  = pet.name;
  doc["species"]   = (uint8_t)pet.species;
  doc["stage"]     = (uint8_t)pet.stage;
  doc["evo_key"]   = pet.evolution_key;
  doc["level"]     = pet.level;
  doc["age_days"]  = pet.age_days;
  doc["coins"]     = pet.coins;
  doc["hunger"]    = pet.hunger;
  doc["happiness"] = pet.happiness;
  doc["health"]    = pet.health;
  doc["energy"]    = pet.energy;

  String body, response;
  serializeJson(doc, body);

  String url = String(_server_host) + "/api/pets/sync";
  return _post(url.c_str(), body, response);
}

bool WiFiSync::checkGifts(Pet& pet, GameEngine& engine) {
  if (!isConnected()) return false;

  String url = String(_server_host) + "/api/gifts/" + WiFi.macAddress();
  String response;
  if (!_get(url.c_str(), response)) return false;

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, response)) return false;

  JsonArray gifts = doc.as<JsonArray>();
  for (JsonObject gift : gifts) {
    const char* type = gift["type"] | "";

    if (strcmp(type, "coins") == 0) {
      uint16_t amount = gift["amount"] | 0;
      pet.coins += amount;
      char msg[32];
      snprintf(msg, sizeof(msg), "Regalo: +%d coins!", amount);
      pet.addMemory(msg);
      pet.care_social_count++;
      pet.happiness = (uint8_t)min(100, (int)pet.happiness +
                      (5 + pet.traits.sociability / 20));
    } else if (strcmp(type, "item") == 0) {
      // Agregar ítem al inventario si hay espacio
      if (pet.inventory_count < 20) {
        Item item;
        item.id     = gift["item_id"] | 0;
        strlcpy(item.name, gift["item_name"] | "Regalo", sizeof(item.name));
        item.type   = gift["item_type"] | 0;
        item.rarity = gift["rarity"]    | 0;
        item.hunger_fx = item.happiness_fx = item.health_fx = item.energy_fx = 0;
        pet.inventory[pet.inventory_count++] = item;
        pet.care_social_count++;
        pet.addMemory("Recibi un regalo!");
      }
    }
  }

  // Marcar regalos como reclamados
  if (gifts.size() > 0) {
    String claim_url = String(_server_host) + "/api/gifts/" +
                       WiFi.macAddress() + "/claim";
    String body = "{}", resp;
    _post(claim_url.c_str(), body, resp);
  }
  return true;
}

bool WiFiSync::checkSeasonalEvent(Pet& pet) {
  if (!isConnected()) return false;

  String url = String(_server_host) + "/api/events/current";
  String response;
  if (!_get(url.c_str(), response)) return false;

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, response)) return false;

  const char* event_name = doc["name"] | "";
  bool has_event = (strlen(event_name) > 0);

  if (has_event) {
    char msg[48];
    snprintf(msg, sizeof(msg), "Evento: %s!", event_name);
    pet.addMemory(msg);
  }
  return has_event;
}

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────
bool WiFiSync::_post(const char* url, const String& body, String& response) {
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  int code = http.POST(body);
  if (code > 0) response = http.getString();
  http.end();
  return (code >= 200 && code < 300);
}

bool WiFiSync::_get(const char* url, String& response) {
  HTTPClient http;
  http.begin(url);
  http.setTimeout(5000);
  int code = http.GET();
  if (code == 200) response = http.getString();
  http.end();
  return (code == 200);
}
