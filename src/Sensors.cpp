#include "Sensors.h"
#include <math.h>

void SensorManager::begin(uint8_t pin_dht, uint8_t pin_ldr,
                          uint8_t pin_sda, uint8_t pin_scl,
                          uint8_t pin_i2s_sck, uint8_t pin_i2s_ws, uint8_t pin_i2s_sd) {
  _pin_ldr = pin_ldr;
  pinMode(pin_ldr, INPUT);

  // DHT22
  _dht = new DHT(pin_dht, DHT22);
  _dht->begin();

  // MPU-6050 vía I2C
  Wire.begin(pin_sda, pin_scl);
  _mpu = new MPU6050(Wire);
  byte status = _mpu->begin();
  if (status == 0) {
    _mpu->calcOffsets(true, true); // calibración automática
  }

  // Inicializar valores
  temperature_c = 25.0f;
  humidity_pct  = 50.0f;
  light_level   = 0.5f;
  steps_delta   = 0;
  is_moving     = false;
  owner_sleeping = false;

  _last_accel_magnitude = 1.0f;
  _last_step_ts         = 0;
  _step_in_progress     = false;
  _last_movement_ts     = millis();
  _still_start_ts       = 0;
  _step_accumulator     = 0;
}

void SensorManager::read() {
  _readDHT();
  _readLDR();
  _readMPU();
  _detectOwnerSleep();
}

void SensorManager::_readDHT() {
  float t = _dht->readTemperature();
  float h = _dht->readHumidity();
  if (!isnan(t)) temperature_c = t;
  if (!isnan(h)) humidity_pct  = h;
}

void SensorManager::_readLDR() {
  // ESP32 ADC: 0-4095 (12 bits)
  uint16_t raw = analogRead(_pin_ldr);
  // LDR: más luz = más resistencia baja = valor ADC más alto
  light_level = raw / 4095.0f;
}

void SensorManager::_readMPU() {
  _mpu->update();
  float ax = _mpu->getAccX();
  float ay = _mpu->getAccY();
  float az = _mpu->getAccZ();
  _detectSteps(ax, ay, az);
}

void SensorManager::_detectSteps(float ax, float ay, float az) {
  float magnitude = sqrtf(ax * ax + ay * ay + az * az);

  // Algoritmo simple de detección de pasos:
  // Un paso ocurre cuando la magnitud cruza un umbral
  const float STEP_THRESHOLD_HIGH = 1.2f;
  const float STEP_THRESHOLD_LOW  = 0.8f;
  const uint32_t MIN_STEP_INTERVAL = 300; // ms entre pasos

  uint32_t now = millis();
  is_moving = (fabsf(magnitude - 1.0f) > 0.15f);

  if (!_step_in_progress && magnitude > STEP_THRESHOLD_HIGH) {
    _step_in_progress = true;
  } else if (_step_in_progress && magnitude < STEP_THRESHOLD_LOW) {
    if (now - _last_step_ts > MIN_STEP_INTERVAL) {
      _step_accumulator++;
      _last_step_ts = now;
      _last_movement_ts = now;
    }
    _step_in_progress = false;
  }

  // Exportar pasos acumulados como delta
  steps_delta = _step_accumulator;
  _step_accumulator = 0;

  _last_accel_magnitude = magnitude;
}

void SensorManager::_detectOwnerSleep() {
  uint32_t now = millis();

  if (!is_moving) {
    if (_still_start_ts == 0) _still_start_ts = now;
    // Sin movimiento por > 1 hora entre 22:00-07:00 → sueño del dueño
    bool long_still = (now - _still_start_ts) > 3600000UL;
    owner_sleeping = long_still;
  } else {
    _still_start_ts = 0;
    owner_sleeping  = false;
  }
}

bool SensorManager::isNight() const {
  return light_level < 0.15f;
}

uint8_t SensorManager::getWeatherIcon() const {
  if (temperature_c > 35.0f) return 3; // calor extremo
  if (temperature_c < 10.0f) return 2; // frío
  if (humidity_pct  > 85.0f) return 4; // lluvia/humedad
  if (light_level   < 0.2f)  return 1; // nublado/noche
  return 0;                             // sol / normal
}
