#pragma once
#include <Arduino.h>
#include <DHT.h>
#include <Wire.h>
#include <MPU6050_light.h>

/*
 * SensorManager – Gestiona todos los sensores físicos:
 *   - DHT22: temperatura y humedad
 *   - LDR:   nivel de luz ambiental (analógico)
 *   - MPU-6050: acelerómetro (contador de pasos del dueño)
 */
class SensorManager {
public:
  // Datos del DHT22
  float temperature_c;    // °C
  float humidity_pct;     // 0-100%

  // Datos del LDR (0.0 = oscuro, 1.0 = luz máxima)
  float light_level;

  // Datos del MPU-6050
  uint32_t steps_delta;   // Nuevos pasos detectados desde última lectura
  bool     is_moving;     // true si hay movimiento activo
  bool     owner_sleeping; // true si sin movimiento por > 1h entre 22-7h

  void begin(uint8_t pin_dht, uint8_t pin_ldr, uint8_t pin_sda, uint8_t pin_scl,
             uint8_t pin_i2s_sck, uint8_t pin_i2s_ws, uint8_t pin_i2s_sd);

  // Lee todos los sensores (llamar cada 30 segundos)
  void read();

  // Indica si la luz es tan baja que sugiere noche
  bool isNight() const;

  // Devuelve ícono ambiental para pantalla: 0=sol, 1=nube, 2=frio, 3=calor, 4=lluvia
  uint8_t getWeatherIcon() const;

private:
  DHT*      _dht;
  MPU6050*  _mpu;
  uint8_t   _pin_ldr;

  // Detector de pasos simple (threshold de aceleración)
  float     _last_accel_magnitude;
  uint32_t  _last_step_ts;
  bool      _step_in_progress;

  // Para detectar sueño del dueño
  uint32_t  _last_movement_ts;
  uint32_t  _still_start_ts;

  // Cuenta de pasos acumulados
  uint32_t  _step_accumulator;

  void _readDHT();
  void _readLDR();
  void _readMPU();
  void _detectSteps(float ax, float ay, float az);
  void _detectOwnerSleep();
};
