#include "Personality.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>

// ─── PersonalityGen ──────────────────────────────────────────────────────────
Personality PersonalityGen::generate(Species species, uint32_t seed) {
  Personality p;
  // Distribución pseudoaleatoria a partir del seed
  uint32_t s = seed;
  auto rnd = [&](uint8_t min_v, uint8_t max_v) -> uint8_t {
    s = s * 1664525UL + 1013904223UL;  // LCG simple
    return (uint8_t)(min_v + (s >> 16) % (max_v - min_v + 1));
  };

  p.curiosity    = rnd(10, 90);
  p.appetite     = rnd(10, 90);
  p.energy_trait = rnd(10, 90);
  p.sociability  = rnd(10, 90);
  p.stubbornness = rnd(10, 90);

  applySpeciesModifiers(p, species);
  return p;
}

void PersonalityGen::applySpeciesModifiers(Personality& p, Species species) {
  // Cada especie tiene tendencia natural en 1-2 rasgos
  switch (species) {
    case Species::FIRE:
      // Fire: naturalmente curiosos y sociales
      p.curiosity  = (uint8_t)min(100, (int)p.curiosity  + 15);
      p.sociability= (uint8_t)min(100, (int)p.sociability + 10);
      break;
    case Species::WATER:
      // Water: más tranquilos, menos tercos
      p.stubbornness= (uint8_t)max(5,  (int)p.stubbornness - 15);
      p.energy_trait= (uint8_t)max(5,  (int)p.energy_trait - 10);
      break;
    case Species::PLANT:
      // Plant: buen apetito, más perezosos
      p.appetite     = (uint8_t)min(100, (int)p.appetite    + 15);
      p.energy_trait = (uint8_t)max(5,   (int)p.energy_trait- 15);
      break;
    case Species::ELECTRIC:
      // Electric: mucha energía y curiosidad, poco apetito
      p.energy_trait = (uint8_t)min(100, (int)p.energy_trait + 20);
      p.curiosity    = (uint8_t)min(100, (int)p.curiosity    + 10);
      p.appetite     = (uint8_t)max(5,   (int)p.appetite     - 15);
      break;
  }
}

// ─── PersonalityAI ───────────────────────────────────────────────────────────
void PersonalityAI::begin(const char* ollama_host) {
  strlcpy(_ollama_host, ollama_host, sizeof(_ollama_host));
  _cache_valid     = false;
  _cache_timestamp = 0;
  loadCache();
}

String PersonalityAI::getDialogue(const Pet& pet) {
  uint32_t now = millis();

  // Usar cache si está vigente
  if (_cache_valid && (now - _cache_timestamp) < CACHE_TTL_MS) {
    return _cached_dialogue;
  }

  // Intentar Ollama
  String dialogue;
  if (fetchFromOllama(pet, dialogue)) {
    _cached_dialogue  = dialogue;
    _cache_timestamp  = now;
    _cache_valid      = true;
    saveCache(dialogue);
    return dialogue;
  }

  // Fallback local
  return getLocalDialogue(pet);
}

bool PersonalityAI::fetchFromOllama(const Pet& pet, String& out_dialogue) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(_ollama_host) + "/api/generate";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000); // 8 segundos máximo

  String prompt = _buildPrompt(pet);

  // Payload para Ollama API
  StaticJsonDocument<512> req;
  req["model"]  = "llama3.2:1b";
  req["prompt"] = prompt;
  req["stream"] = false;
  String body;
  serializeJson(req, body);

  int code = http.POST(body);
  if (code != 200) {
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  out_dialogue = _parseOllamaResponse(response);
  return out_dialogue.length() > 0;
}

String PersonalityAI::_buildPrompt(const Pet& pet) const {
  char buf[512];
  const char* species_names[] = { "Fuego", "Agua", "Planta", "Electrico" };

  snprintf(buf, sizeof(buf),
    "Eres un pet virtual de tipo %s llamado %s. "
    "Tus rasgos de personalidad son: "
    "Curiosidad=%d, Apetito=%d, Energia=%d, Sociabilidad=%d, Terquedad=%d. "
    "Estado actual: hambre=%d, felicidad=%d, salud=%d, energia=%d. "
    "Genera UNA sola frase corta (maximo 55 caracteres) en espanol que exprese "
    "como te sientes ahora mismo, en primera persona, acorde a tu personalidad. "
    "Solo la frase, sin comillas, sin explicaciones.",
    species_names[(int)pet.species],
    pet.name,
    pet.traits.curiosity,
    pet.traits.appetite,
    pet.traits.energy_trait,
    pet.traits.sociability,
    pet.traits.stubbornness,
    pet.hunger,
    pet.happiness,
    pet.health,
    pet.energy
  );
  return String(buf);
}

String PersonalityAI::_parseOllamaResponse(const String& json_response) const {
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, json_response);
  if (err) return "";
  const char* text = doc["response"] | "";
  // Limpiar comillas y espacios extra
  String result = String(text);
  result.trim();
  result.replace("\"", "");
  if (result.length() > 55) result = result.substring(0, 52) + "...";
  return result;
}

// ─── Diálogos locales (fallback sin internet) ────────────────────────────────
String PersonalityAI::getLocalDialogue(const Pet& pet) const {
  // Prioridad: stat más crítico primero
  if (pet.hunger < 20)    return _templateForHunger(pet);
  if (pet.health < 20)    return _templateForHealth(pet);
  if (pet.happiness < 20) return _templateForHappiness(pet);
  if (pet.energy < 20)    return _templateForEnergy(pet);
  return _templateIdle(pet);
}

String PersonalityAI::_templateForHunger(const Pet& pet) const {
  if (pet.traits.appetite > 70)
    return "Tengo MUCHA hambre! Por favor dame algo!";
  if (pet.traits.stubbornness > 70)
    return "No me voy a mover hasta que me des comida.";
  return "Mi estomago esta vacio... necesito comer.";
}

String PersonalityAI::_templateForHappiness(const Pet& pet) const {
  if (pet.traits.curiosity > 70)
    return "Me aburro mucho! Quiero explorar algo nuevo!";
  if (pet.traits.sociability > 70)
    return "Me siento solo... ven a jugar conmigo.";
  return "Estoy un poco triste hoy...";
}

String PersonalityAI::_templateForEnergy(const Pet& pet) const {
  if (pet.traits.energy_trait > 70)
    return "Increible... yo nunca me canso, pero hoy si.";
  if (pet.traits.stubbornness > 70)
    return "No voy a dormir. Definitivamente no.";
  return "Mis ojos se cierran solos... quiero dormir.";
}

String PersonalityAI::_templateForHealth(const Pet& pet) const {
  if (pet.traits.stubbornness > 70)
    return "Estoy bien! No necesito medicina. Okay, si.";
  return "Me duele la panza... creo que necesito medicina.";
}

String PersonalityAI::_templateIdle(const Pet& pet) const {
  // Pet está bien, frase según personalidad dominante
  uint8_t max_t = pet.traits.curiosity;
  int dominant = 0;
  if (pet.traits.sociability  > max_t) { max_t = pet.traits.sociability;  dominant = 1; }
  if (pet.traits.energy_trait > max_t) { max_t = pet.traits.energy_trait; dominant = 2; }
  if (pet.traits.appetite     > max_t) { max_t = pet.traits.appetite;     dominant = 3; }

  switch (dominant) {
    case 0: return "Me pregunto que hay detras de esa puerta...";
    case 1: return "Hola! Me alegra que estes aqui conmigo!";
    case 2: return "Vamos a correr! Tengo energia de sobra!";
    case 3: return "Todo esta bien... mientras haya comida.";
    default: return "...";
  }
}

// ─── Cache en LittleFS ───────────────────────────────────────────────────────
void PersonalityAI::loadCache() {
  File f = LittleFS.open("/ai_cache.txt", "r");
  if (!f) return;
  _cached_dialogue  = f.readStringUntil('\n');
  _cache_timestamp  = f.readStringUntil('\n').toInt();
  _cache_valid      = (_cached_dialogue.length() > 0);
  f.close();
}

void PersonalityAI::saveCache(const String& dialogue) {
  File f = LittleFS.open("/ai_cache.txt", "w");
  if (!f) return;
  f.println(dialogue);
  f.println(_cache_timestamp);
  f.close();
}
