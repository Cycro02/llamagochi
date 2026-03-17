# Tamagotchi Next Level – ESP32

Tamagotchi físico y portable con IA de personalidad única, sensores ambientales, reconocimiento de voz, sistema de sobres tipo Pokémon y casa decorable.

## Hardware Requerido

| Componente | Uso |
|-----------|-----|
| ESP32 (4MB Flash) | MCU principal |
| TFT ILI9341 o ST7789 240x320 | Pantalla color |
| 4x Pulsadores | Botones A/B/C/D |
| DHT22 | Temperatura y humedad |
| Fotorresistencia LDR | Nivel de luz |
| MPU-6050 | Acelerómetro (pasos del dueño) |
| INMP441 (I2S) | Micrófono reconocimiento de voz |
| Piezo buzzer | Sonidos y melodías |
| LiPo 500mAh + TP4056 | Batería portátil |

## Pines

| Pin | Función |
|-----|---------|
| GPIO 0  | Botón A (Acción) |
| GPIO 35 | Botón B (Menú) |
| GPIO 34 | Botón C (Arriba) |
| GPIO 39 | Botón D (Abajo) |
| GPIO 4  | DHT22 |
| GPIO 36 | LDR (analógico) |
| GPIO 21 | SDA (MPU-6050) |
| GPIO 22 | SCL (MPU-6050) |
| GPIO 26 | I2S SCK (micrófono) |
| GPIO 27 | I2S WS (micrófono) |
| GPIO 14 | I2S SD (micrófono) |
| GPIO 25 | Buzzer |
| TFT_eSPI config | Ver User_Setup.h |

## Librerías Arduino (instalar en Arduino IDE)

```
TFT_eSPI          (Bodmer)
ArduinoJson       (Benoit Blanchon)
DHT sensor library (Adafruit)
MPU6050_light     (rfetick)
```

## Configuración TFT_eSPI

En `Arduino/libraries/TFT_eSPI/User_Setup.h`:
```cpp
#define ILI9341_DRIVER   // o ST7789_DRIVER
#define TFT_MOSI 23
#define TFT_SCLK 18
#define TFT_CS   15
#define TFT_DC    2
#define TFT_RST   4
#define TFT_BL   32   // Backlight (opcional)
```

## Setup del Servidor Social

```bash
cd server/
npm install
node server.js   # corre en puerto 3001
```

### Configurar IP en tamagotchi.ino

```cpp
#define WIFI_SSID     "tu_red"
#define WIFI_PASSWORD "tu_password"
#define OLLAMA_HOST   "http://192.168.1.100:11434"  // PC con Ollama
#define SERVER_HOST   "http://192.168.1.100:3001"   // Este servidor
```

## IA con Ollama (gratuita, local)

1. Instalar Ollama: https://ollama.com
2. Bajar modelo: `ollama pull llama3.2:1b`
3. Correr: `ollama serve` (queda en puerto 11434)

El ESP32 genera diálogos únicos para cada pet sin pagar ninguna API.

## Reconocimiento de Voz (Whisper)

```bash
pip install openai-whisper
# El servidor usa ffmpeg + whisper automáticamente
```

## Convertir sprites PNG a PROGMEM

```bash
cd tools/
python img_to_progmem.py ../sprites/fire_baby.png --name spr_fire_baby
# Genera spr_fire_baby.h con el array C++ listo para usar
```

## Características del Juego

### Personalidad Única
Cada pet nace con 5 rasgos aleatorios (Curiosidad, Apetito, Energía, Sociabilidad, Terquedad) que afectan su comportamiento, diálogos y camino evolutivo. Nunca habrá dos pets exactamente iguales.

### Evolución Diferenciada
El camino evolutivo depende de CÓMO cuidas al pet según SUS rasgos:
- Pet curioso evoluciona mejor si juegas mucho con él
- Pet apetitoso evoluciona mejor con buena alimentación
- Resultado: cientos de combinaciones de evolución únicas

### Sistema de Sobres
Compra sobres (Común 50c / Raro 150c / Épico 400c) para obtener ropa y accesorios:
- **Común** (60%): ropa básica
- **Poco Común** (25%): accesorios
- **Raro** (12%): outfits completos
- **Épico** (3%): ítems animados únicos

### Casa Decorable
Tu pet vive en una habitación con 6 slots decorables:
- Cama (afecta recuperación de energía)
- 2 muebles (TV, sofá, plantas - efecto en happiness/health)
- 2 decoraciones
- Tipo de piso

### Sensores Ambientales
- **Calor > 32°C**: el pet tiene más sed/hambre
- **Frío < 12°C**: el pet consume más energía
- **Oscuridad (LDR)**: el pet duerme automáticamente de noche

### Fitness del Dueño
El acelerómetro detecta tus pasos:
- Cada 1,000 pasos → el pet gana +5 energía y +3 felicidad
- Si duermes bien (sin movimiento nocturno) → pet recibe +15 energía al despertar

### Reconocimiento de Voz
Presiona el botón de voz y habla:
- Llama al pet por su nombre → animación de saludo
- "come", "juega", "duerme", "tienda" → ejecuta la acción

### Mini-juegos (5/día)
1. **Secuencia Relámpago** (Simon Says) – repite secuencias de botones
2. **Reacción Rápida** – presiona el botón correcto en < 500ms
3. **Adivina el Número** – adivina 1-10 con botones arriba/abajo
