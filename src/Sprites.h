#pragma once
#include <Arduino.h>
#include <pgmspace.h>

/*
 * Sprites.h – Pixel art en PROGMEM para la pantalla TFT
 *
 * Formato: arrays de uint16_t en RGB565 (16 bits por píxel)
 * Sprites de pet: 32x32 píxeles
 * Íconos UI: 16x16 píxeles
 * Color transparente: 0xF81F (magenta puro)
 * Color de cuerpo tintable: 0xEEEE (gris claro → reemplazado en runtime)
 */

// ─── Dimensiones ─────────────────────────────────────────────────────────────
#define SPRITE_W   32
#define SPRITE_H   32
#define SPRITE_SZ  (SPRITE_W * SPRITE_H)
#define ICON_W     16
#define ICON_H     16
#define TRANSPARENT 0xF81F   // Magenta = transparente

// ─── Sprites de pet (6 etapas evolutivas) ────────────────────────────────────
#include "spr_llama_egg.h"
#include "spr_llama_baby.h"
#include "spr_llama_child.h"
#include "spr_llama_teen.h"
#include "spr_llama_adult.h"
#include "spr_llama_elder.h"

// ─── Íconos de clima UI (16×16) ───────────────────────────────────────────────
#include "icon_sun.h"
#include "icon_cloud.h"
#include "icon_cold.h"
#include "icon_hot.h"
#include "icon_rain.h"

// ─── Color de especie (tint para el cuerpo del pet) ──────────────────────────
inline uint16_t speciesColor(uint8_t species) {
  switch (species) {
    case 0: return 0xFBA0; // FIRE      → naranja
    case 1: return 0x041F; // WATER     → azul
    case 2: return 0x07E0; // PLANT     → verde
    case 3: return 0xFFE0; // ELECTRIC  → amarillo
    default: return 0xEEEE;
  }
}

// ─── Sprite del pet según etapa ──────────────────────────────────────────────
inline const uint16_t* getSpriteForPet(uint8_t species, uint8_t stage) {
  switch (stage) {
    case 0: return spr_llama_egg;
    case 1: return spr_llama_baby;
    case 2: return spr_llama_child;
    case 3: return spr_llama_teen;
    case 4: return spr_llama_adult;
    case 5: return spr_llama_elder;
    default: return spr_llama_egg;
  }
}

// ─── Ícono climático ──────────────────────────────────────────────────────────
// icon_type: 0=sol, 1=nube, 2=frío, 3=calor, 4=lluvia
inline const uint16_t* getWeatherIcon(uint8_t icon_type) {
  switch (icon_type) {
    case 0: return icon_sun;
    case 1: return icon_cloud;
    case 2: return icon_cold;
    case 3: return icon_hot;
    case 4: return icon_rain;
    default: return icon_sun;
  }
}
