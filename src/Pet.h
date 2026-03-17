#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

// ─── Enums ──────────────────────────────────────────────────────────────────
enum class Species : uint8_t {
  FIRE    = 0,  // Felicidad +rápido con juegos
  WATER   = 1,  // Salud se recupera +rápido
  PLANT   = 2,  // Hambre decae +lento
  ELECTRIC= 3   // Energía regenera +rápido
};

enum class Stage : uint8_t {
  EGG     = 0,
  BABY    = 1,
  CHILD   = 2,
  TEEN    = 3,
  ADULT   = 4,
  ELDER   = 5
};

// ─── Personalidad (generada al nacer, nunca cambia) ─────────────────────────
struct Personality {
  uint8_t curiosity;    // 0-100: felicidad baja rápido sin jugar
  uint8_t appetite;     // 0-100: hambre decae más/menos rápido
  uint8_t energy_trait; // 0-100: ciclo sueño/vigilia
  uint8_t sociability;  // 0-100: bonus felicidad por visitas/regalos
  uint8_t stubbornness; // 0-100: necesita cuidado específico para evolucionar bien
};

// ─── Item de inventario ─────────────────────────────────────────────────────
struct Item {
  uint8_t  id;
  char     name[24];
  uint8_t  type;       // 0=comida, 1=juguete, 2=medicina, 3=ropa, 4=mueble
  int8_t   hunger_fx;
  int8_t   happiness_fx;
  int8_t   health_fx;
  int8_t   energy_fx;
  uint8_t  rarity;     // 0=común, 1=poco común, 2=raro, 3=épico
};

// ─── Slot de ropa ───────────────────────────────────────────────────────────
struct Wardrobe {
  int8_t hat_id;        // -1 = vacío
  int8_t shirt_id;
  int8_t pants_id;
  int8_t shoes_id;
  int8_t accessory_id;
};

// ─── Slot de casa ────────────────────────────────────────────────────────────
struct House {
  int8_t  bed_id;         // -1 = cama básica
  int8_t  furniture_l;    // mueble izquierdo
  int8_t  furniture_r;    // mueble derecho
  int8_t  decor_top;      // decoración superior (ventana, poster)
  int8_t  wallpaper_id;
  int8_t  floor_id;
};

// ─── Memoria / bitácora ─────────────────────────────────────────────────────
struct Memory {
  char     description[48];
  uint32_t timestamp;
};

// ─── Pet ────────────────────────────────────────────────────────────────────
class Pet {
public:
  // Identidad
  char        name[16];
  Species     species;
  Personality traits;
  Stage       stage;
  uint32_t    birth_timestamp;
  uint8_t     age_days;

  // Stats vitales (0-100)
  uint8_t     hunger;     // 100 = lleno
  uint8_t     happiness;  // 100 = muy feliz
  uint8_t     health;     // 100 = sano
  uint8_t     energy;     // 100 = lleno de energía

  // Progresión
  uint16_t    coins;
  uint16_t    xp;
  uint8_t     level;

  // Estado
  bool        is_alive;
  bool        is_sleeping;
  uint32_t    last_low_stat_ts; // para muerte por negligencia

  // Cuidado acumulado (para calcular evolución)
  uint32_t    care_play_count;    // veces que jugó
  uint32_t    care_feed_count;    // veces que comió bien
  uint32_t    care_sleep_count;   // siestas completas
  uint32_t    care_social_count;  // visitas/regalos recibidos

  // Apariencia
  Wardrobe    wardrobe;
  House       house;
  char        evolution_key[16]; // ej: "pyro_curious_A"

  // Inventario
  Item        inventory[20];
  uint8_t     inventory_count;

  // Bitácora de memorias
  Memory      memories[10];
  uint8_t     memory_count;

  // Stats de fitness del dueño
  uint32_t    owner_steps_today;
  uint32_t    owner_steps_record;

  // Mini-juegos (límite diario)
  uint8_t     games_played_today;
  uint32_t    last_game_day;    // día UTC del último juego

  Pet();

  // ── Acciones ────────────────────────────────────────────────────────────
  void feed(const Item& food);
  void play();
  void sleep_action();
  void wake_up();
  void heal(const Item& medicine);

  // ── Lógica de evolución ─────────────────────────────────────────────────
  bool  checkEvolution();
  void  computeEvolutionKey();   // genera evolution_key único
  float careScore() const;       // 0.0–1.0

  // ── Decaimiento de stats (llamado cada 10min) ───────────────────────────
  void tick(float temp_c, float humidity_pct, float light_pct);

  // ── Fitness ─────────────────────────────────────────────────────────────
  void addOwnerSteps(uint32_t steps);
  void onOwnerGoodSleep();

  // ── Memorias ────────────────────────────────────────────────────────────
  void addMemory(const char* desc);

  // ── Serialización ────────────────────────────────────────────────────────
  void toJson(JsonObject& obj) const;
  void fromJson(const JsonObject& obj);

private:
  float _speciesHungerMod() const;
  float _speciesEnergyMod() const;
  float _speciesHealthMod() const;
  float _speciesHappinessMod() const;
};
