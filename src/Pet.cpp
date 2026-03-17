#include "Pet.h"
#include <string.h>
#include <math.h>

Pet::Pet() {
  memset(name, 0, sizeof(name));
  species      = Species::FIRE;
  stage        = Stage::EGG;
  birth_timestamp = 0;
  age_days     = 0;
  hunger       = 80;
  happiness    = 80;
  health       = 100;
  energy       = 80;
  coins        = 50;
  xp           = 0;
  level        = 1;
  is_alive     = true;
  is_sleeping  = false;
  last_low_stat_ts = 0;
  care_play_count  = 0;
  care_feed_count  = 0;
  care_sleep_count = 0;
  care_social_count = 0;
  inventory_count  = 0;
  memory_count     = 0;
  owner_steps_today   = 0;
  owner_steps_record  = 0;
  games_played_today  = 0;
  last_game_day       = 0;
  memset(evolution_key, 0, sizeof(evolution_key));

  // Casa por defecto
  house = { -1, -1, -1, -1, -1, -1 };

  // Armario por defecto
  wardrobe = { -1, -1, -1, -1, -1 };
}

// ─── Modificadores por especie ───────────────────────────────────────────────
float Pet::_speciesHungerMod() const {
  // PLANT: hambre decae 30% más lento
  return (species == Species::PLANT) ? 0.7f : 1.0f;
}
float Pet::_speciesEnergyMod() const {
  // ELECTRIC: energy regenera 30% más rápido (decae 30% más lento)
  return (species == Species::ELECTRIC) ? 0.7f : 1.0f;
}
float Pet::_speciesHealthMod() const {
  // WATER: salud se recupera 30% más rápido (penalties menores)
  return (species == Species::WATER) ? 0.7f : 1.0f;
}
float Pet::_speciesHappinessMod() const {
  // FIRE: felicidad sube 30% más con juegos (penalidad normal)
  return (species == Species::FIRE) ? 0.7f : 1.0f;
}

// ─── Decaimiento de stats ────────────────────────────────────────────────────
void Pet::tick(float temp_c, float humidity_pct, float light_pct) {
  if (!is_alive || is_sleeping) return;

  // ── Hambre ──────────────────────────────────────────────────────────────
  float hunger_decay = 5.0f;
  hunger_decay *= _speciesHungerMod();
  // Alta curiosidad = más activo = más hambre
  hunger_decay += (traits.curiosity / 100.0f) * 2.0f;
  // Calor: > 32°C duplica sed/hambre
  if (temp_c > 32.0f) hunger_decay *= 2.0f;
  // Frío: < 12°C aumenta hambre (más calorías necesarias)
  if (temp_c < 12.0f) hunger_decay *= 1.5f;
  hunger = (uint8_t)max(0, (int)hunger - (int)hunger_decay);

  // ── Felicidad ──────────────────────────────────────────────────────────
  float hap_decay = 3.0f;
  // Alta curiosidad = aburrimiento más rápido
  hap_decay += (traits.curiosity / 100.0f) * 3.0f;
  // Humedad extrema
  if (humidity_pct > 80.0f) hap_decay += 3.0f;
  // Bonus por humedad ideal
  if (humidity_pct >= 40.0f && humidity_pct <= 60.0f) hap_decay -= 1.0f;
  happiness = (uint8_t)max(0, (int)happiness - (int)max(0.0f, hap_decay));

  // ── Energía ─────────────────────────────────────────────────────────────
  float energy_decay = 2.0f;
  energy_decay *= _speciesEnergyMod();
  // Alta energía_trait → más activo → más cansancio
  energy_decay += (traits.energy_trait / 100.0f) * 2.0f;
  energy = (uint8_t)max(0, (int)energy - (int)energy_decay);

  // ── Salud ────────────────────────────────────────────────────────────────
  // Si hambre < 20 → salud cae
  if (hunger < 20) {
    float health_penalty = 5.0f * _speciesHealthMod();
    health = (uint8_t)max(0, (int)health - (int)health_penalty);
  }

  // ── Efectos de la casa ───────────────────────────────────────────────────
  if (house.furniture_l == 2 || house.furniture_r == 2) {
    // TV → +2 happiness por tick si está en casa
    happiness = (uint8_t)min(100, (int)happiness + 2);
  }
  if (house.decor_top == 3) {
    // Planta → +1 health cada tick (30 seg * 4 ticks = 2min aprox)
    health = (uint8_t)min(100, (int)health + 1);
  }

  // ── Muerte por negligencia ───────────────────────────────────────────────
  bool critical = (hunger < 10 || happiness < 10 || health < 10);
  uint32_t now = millis();
  if (critical) {
    if (last_low_stat_ts == 0) last_low_stat_ts = now;
    if (now - last_low_stat_ts > 1800000UL) { // 30 min en estado crítico
      is_alive = false;
      addMemory("Murio por falta de cuidado");
    }
  } else {
    last_low_stat_ts = 0;
  }

  // ── Evolución ────────────────────────────────────────────────────────────
  checkEvolution();
}

// ─── Acciones ────────────────────────────────────────────────────────────────
void Pet::feed(const Item& food) {
  if (!is_alive) return;
  hunger    = (uint8_t)min(100, (int)hunger    + food.hunger_fx);
  happiness = (uint8_t)min(100, (int)happiness + food.happiness_fx);
  health    = (uint8_t)min(100, (int)health    + food.health_fx);
  energy    = (uint8_t)min(100, (int)energy    + food.energy_fx);
  care_feed_count++;
  xp += 2;
}

void Pet::play() {
  if (!is_alive || energy < 10) return;
  uint8_t hap_gain = 20;
  if (species == Species::FIRE) hap_gain = 26; // FIRE bonus
  happiness = (uint8_t)min(100, (int)happiness + hap_gain);
  energy    = (uint8_t)max(0,   (int)energy    - 15);
  hunger    = (uint8_t)max(0,   (int)hunger    - 5);
  care_play_count++;
  xp += 3;
}

void Pet::sleep_action() {
  if (!is_alive || is_sleeping) return;
  is_sleeping = true;
  addMemory("Fue a dormir");
}

void Pet::wake_up() {
  if (!is_sleeping) return;
  is_sleeping = false;
  uint8_t energy_gain = 40;
  // Cama de nivel alto: +10 bonus
  if (house.bed_id >= 2) energy_gain += 10;
  energy = (uint8_t)min(100, (int)energy + energy_gain);
  care_sleep_count++;
  xp += 2;
  addMemory("Desperto descansado");
}

void Pet::heal(const Item& medicine) {
  if (!is_alive) return;
  health    = (uint8_t)min(100, (int)health    + medicine.health_fx);
  happiness = (uint8_t)min(100, (int)happiness + medicine.happiness_fx);
  xp += 2;
}

// ─── Fitness del dueño ───────────────────────────────────────────────────────
void Pet::addOwnerSteps(uint32_t steps) {
  owner_steps_today += steps;
  if (owner_steps_today > owner_steps_record)
    owner_steps_record = owner_steps_today;
  // Cada 1000 pasos: +5 energy, +3 happiness
  uint32_t bonuses = owner_steps_today / 1000;
  if (bonuses > 0) {
    energy    = (uint8_t)min(100, (int)energy    + 5 * (int)bonuses);
    happiness = (uint8_t)min(100, (int)happiness + 3 * (int)bonuses);
    owner_steps_today %= 1000;
  }
}

void Pet::onOwnerGoodSleep() {
  // Dueño durmió bien → pet también recibe bonus
  energy    = (uint8_t)min(100, (int)energy    + 15);
  happiness = (uint8_t)min(100, (int)happiness + 5);
  addMemory("Duenio durmio bien, pet descansado");
}

// ─── Evolución ───────────────────────────────────────────────────────────────
float Pet::careScore() const {
  // Promedio ponderado de cuidado
  float play   = min(1.0f, care_play_count  / 50.0f);
  float feed   = min(1.0f, care_feed_count  / 100.0f);
  float sleep  = min(1.0f, care_sleep_count / 20.0f);
  float social = min(1.0f, care_social_count/ 10.0f);

  // Ponderación según personalidad
  float w_play   = 0.5f + (traits.curiosity    / 200.0f); // curiosos valoran más el juego
  float w_social = 0.5f + (traits.sociability  / 200.0f);
  float w_feed   = 0.5f + (traits.appetite     / 200.0f);
  float w_sleep  = 0.5f + (traits.energy_trait / 200.0f);

  float total = (play * w_play + feed * w_feed + sleep * w_sleep + social * w_social);
  float max_possible = (w_play + w_feed + w_sleep + w_social);
  return total / max_possible;
}

bool Pet::checkEvolution() {
  Stage next = stage;
  uint32_t now = millis();
  uint32_t age_ms = now - birth_timestamp;

  if (stage == Stage::EGG   && age_ms > 86400000UL)   next = Stage::BABY;
  if (stage == Stage::BABY  && age_ms > 259200000UL)  next = Stage::CHILD;
  if (stage == Stage::CHILD && age_ms > 432000000UL)  next = Stage::TEEN;
  if (stage == Stage::TEEN  && age_ms > 864000000UL)  next = Stage::ADULT;
  if (stage == Stage::ADULT && age_ms > 1728000000UL) next = Stage::ELDER;

  if (next != stage) {
    stage = next;
    computeEvolutionKey();
    char mem[48];
    snprintf(mem, sizeof(mem), "Evoluciono a etapa %d!", (int)stage);
    addMemory(mem);
    xp += 50;
    return true;
  }
  return false;
}

void Pet::computeEvolutionKey() {
  // Genera una clave única basada en especie + rasgos dominantes + cuidado
  const char* species_str[] = { "pyro", "aqua", "flora", "volt" };
  const char* trait_str;

  // Rasgo dominante
  uint8_t max_trait = traits.curiosity;
  trait_str = "curious";
  if (traits.appetite     > max_trait) { max_trait = traits.appetite;     trait_str = "hungry";  }
  if (traits.energy_trait > max_trait) { max_trait = traits.energy_trait; trait_str = "active";  }
  if (traits.sociability  > max_trait) { max_trait = traits.sociability;  trait_str = "social";  }
  if (traits.stubbornness > max_trait) { max_trait = traits.stubbornness; trait_str = "stubborn";}

  // Camino de cuidado
  char path = (careScore() > 0.75f) ? 'A' : (careScore() > 0.45f) ? 'B' : 'C';

  snprintf(evolution_key, sizeof(evolution_key), "%s_%s_%c",
           species_str[(int)species], trait_str, path);
}

// ─── Memorias ─────────────────────────────────────────────────────────────────
void Pet::addMemory(const char* desc) {
  if (memory_count < 10) {
    strncpy(memories[memory_count].description, desc, 47);
    memories[memory_count].description[47] = '\0';
    memories[memory_count].timestamp = millis();
    memory_count++;
  } else {
    // Desplazar memorias (circular)
    memmove(&memories[0], &memories[1], sizeof(Memory) * 9);
    strncpy(memories[9].description, desc, 47);
    memories[9].description[47] = '\0';
    memories[9].timestamp = millis();
  }
}

// ─── Serialización ────────────────────────────────────────────────────────────
void Pet::toJson(JsonObject& obj) const {
  obj["name"]       = name;
  obj["species"]    = (uint8_t)species;
  obj["stage"]      = (uint8_t)stage;
  obj["birth_ts"]   = birth_timestamp;
  obj["age_days"]   = age_days;
  obj["hunger"]     = hunger;
  obj["happiness"]  = happiness;
  obj["health"]     = health;
  obj["energy"]     = energy;
  obj["coins"]      = coins;
  obj["xp"]         = xp;
  obj["level"]      = level;
  obj["is_alive"]   = is_alive;
  obj["is_sleeping"]= is_sleeping;
  obj["evo_key"]    = evolution_key;

  obj["p_curiosity"]   = traits.curiosity;
  obj["p_appetite"]    = traits.appetite;
  obj["p_energy"]      = traits.energy_trait;
  obj["p_sociability"] = traits.sociability;
  obj["p_stubbornness"]= traits.stubbornness;

  obj["c_play"]   = care_play_count;
  obj["c_feed"]   = care_feed_count;
  obj["c_sleep"]  = care_sleep_count;
  obj["c_social"] = care_social_count;

  obj["h_bed"]   = house.bed_id;
  obj["h_fl"]    = house.furniture_l;
  obj["h_fr"]    = house.furniture_r;
  obj["h_dt"]    = house.decor_top;
  obj["h_wp"]    = house.wallpaper_id;
  obj["h_fl2"]   = house.floor_id;

  obj["w_hat"]   = wardrobe.hat_id;
  obj["w_shirt"] = wardrobe.shirt_id;
  obj["w_pants"] = wardrobe.pants_id;
  obj["w_shoes"] = wardrobe.shoes_id;
  obj["w_acc"]   = wardrobe.accessory_id;

  obj["steps_today"]  = owner_steps_today;
  obj["steps_record"] = owner_steps_record;
  obj["games_today"]  = games_played_today;
  obj["last_game_day"]= last_game_day;
}

void Pet::fromJson(const JsonObject& obj) {
  strlcpy(name, obj["name"] | "Pet", sizeof(name));
  species      = (Species)(uint8_t)(obj["species"]  | 0);
  stage        = (Stage)(uint8_t)(obj["stage"]      | 0);
  birth_timestamp = obj["birth_ts"] | (uint32_t)0;
  age_days     = obj["age_days"]    | 0;
  hunger       = obj["hunger"]      | 80;
  happiness    = obj["happiness"]   | 80;
  health       = obj["health"]      | 100;
  energy       = obj["energy"]      | 80;
  coins        = obj["coins"]       | 50;
  xp           = obj["xp"]         | 0;
  level        = obj["level"]       | 1;
  is_alive     = obj["is_alive"]    | true;
  is_sleeping  = obj["is_sleeping"] | false;
  strlcpy(evolution_key, obj["evo_key"] | "", sizeof(evolution_key));

  traits.curiosity    = obj["p_curiosity"]    | 50;
  traits.appetite     = obj["p_appetite"]     | 50;
  traits.energy_trait = obj["p_energy"]       | 50;
  traits.sociability  = obj["p_sociability"]  | 50;
  traits.stubbornness = obj["p_stubbornness"] | 50;

  care_play_count  = obj["c_play"]   | (uint32_t)0;
  care_feed_count  = obj["c_feed"]   | (uint32_t)0;
  care_sleep_count = obj["c_sleep"]  | (uint32_t)0;
  care_social_count= obj["c_social"] | (uint32_t)0;

  house.bed_id      = obj["h_bed"]  | -1;
  house.furniture_l = obj["h_fl"]   | -1;
  house.furniture_r = obj["h_fr"]   | -1;
  house.decor_top   = obj["h_dt"]   | -1;
  house.wallpaper_id= obj["h_wp"]   | -1;
  house.floor_id    = obj["h_fl2"]  | -1;

  wardrobe.hat_id      = obj["w_hat"]   | -1;
  wardrobe.shirt_id    = obj["w_shirt"] | -1;
  wardrobe.pants_id    = obj["w_pants"] | -1;
  wardrobe.shoes_id    = obj["w_shoes"] | -1;
  wardrobe.accessory_id= obj["w_acc"]   | -1;

  owner_steps_today  = obj["steps_today"]   | (uint32_t)0;
  owner_steps_record = obj["steps_record"]  | (uint32_t)0;
  games_played_today = obj["games_today"]   | 0;
  last_game_day      = obj["last_game_day"] | (uint32_t)0;
}
