#pragma once
#include <Arduino.h>
#include "Pet.h"

/*
 * PersonalityGen  – Genera rasgos únicos al nacer usando un seed
 * PersonalityAI   – Genera diálogos usando Ollama (LLM local gratuito)
 *                   con fallback a templates locales si no hay WiFi
 */

// ─── Templates de diálogo por rasgo + estado ────────────────────────────────
// Índices de templates: usados cuando Ollama no está disponible
struct DialogueTemplate {
  const char* condition;  // descripción de cuándo aplica
  const char* text;       // frase en español (max 60 chars)
};

class PersonalityGen {
public:
  // Genera personalidad única basada en especie + seed (tiempo de creación)
  static Personality generate(Species species, uint32_t seed);

private:
  // Modifica rasgos base según especie
  static void applySpeciesModifiers(Personality& p, Species species);
};

class PersonalityAI {
public:
  // Inicializar con URL de Ollama
  void begin(const char* ollama_host);

  // Obtener diálogo del pet (usa cache si está disponible)
  // Llama a Ollama si hay WiFi, sino usa templates locales
  String getDialogue(const Pet& pet);

  // Forzar actualización del diálogo desde Ollama
  bool fetchFromOllama(const Pet& pet, String& out_dialogue);

  // Diálogo local basado en templates (sin internet)
  String getLocalDialogue(const Pet& pet) const;

  // Cache en LittleFS
  void loadCache();
  void saveCache(const String& dialogue);

private:
  char      _ollama_host[64];
  String    _cached_dialogue;
  uint32_t  _cache_timestamp;
  bool      _cache_valid;

  static const uint32_t CACHE_TTL_MS = 3600000UL; // 1 hora

  String _buildPrompt(const Pet& pet) const;
  String _parseOllamaResponse(const String& json_response) const;

  // Templates locales organizados por situación
  String _templateForHunger(const Pet& pet) const;
  String _templateForHappiness(const Pet& pet) const;
  String _templateForEnergy(const Pet& pet) const;
  String _templateForHealth(const Pet& pet) const;
  String _templateIdle(const Pet& pet) const;
};
