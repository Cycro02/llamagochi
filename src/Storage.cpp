#include "Storage.h"
#include <LittleFS.h>
#include <ArduinoJson.h>

#define PET_FILE        "/pet.json"
#define COMPENDIUM_FILE "/compendium.json"

bool Storage::load(Pet& pet) {
  File f = LittleFS.open(PET_FILE, "r");
  if (!f) return false;

  StaticJsonDocument<1536> doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();

  if (err) return false;

  JsonObject obj = doc.as<JsonObject>();
  pet.fromJson(obj);
  return pet.is_alive || true; // cargar aunque esté muerto (para compendio)
}

bool Storage::save(const Pet& pet) {
  StaticJsonDocument<1536> doc;
  JsonObject obj = doc.to<JsonObject>();
  pet.toJson(obj);

  File f = LittleFS.open(PET_FILE, "w");
  if (!f) return false;

  serializeJson(doc, f);
  f.close();
  return true;
}

void Storage::reset() {
  LittleFS.remove(PET_FILE);
}

bool Storage::appendToCompendium(const Pet& pet) {
  // Cargar compendio existente
  StaticJsonDocument<4096> doc;
  File rf = LittleFS.open(COMPENDIUM_FILE, "r");
  if (rf) {
    deserializeJson(doc, rf);
    rf.close();
  } else {
    doc.to<JsonArray>();
  }

  // Agregar entrada del pet fallecido/retirado
  JsonArray arr = doc.as<JsonArray>();
  JsonObject entry = arr.createNestedObject();
  entry["name"]    = pet.name;
  entry["species"] = (uint8_t)pet.species;
  entry["evo_key"] = pet.evolution_key;
  entry["age_days"]= pet.age_days;
  entry["stage"]   = (uint8_t)pet.stage;
  entry["max_coins"] = pet.coins;
  entry["birth_ts"]  = pet.birth_timestamp;
  entry["p_curiosity"]    = pet.traits.curiosity;
  entry["p_sociability"]  = pet.traits.sociability;

  File wf = LittleFS.open(COMPENDIUM_FILE, "w");
  if (!wf) return false;
  serializeJson(doc, wf);
  wf.close();
  return true;
}

String Storage::loadCompendium() {
  File f = LittleFS.open(COMPENDIUM_FILE, "r");
  if (!f) return "[]";
  String content = f.readString();
  f.close();
  return content;
}
