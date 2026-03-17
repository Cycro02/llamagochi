/**
 * LlamaGochi – Backend Social + Web Game
 *
 * Endpoints sociales (ESP32 + Web):
 *   POST /api/pets/sync          – Subir estado del pet al leaderboard
 *   GET  /api/leaderboard        – Top 10 pets
 *   GET  /api/pets/online        – Pets en línea (vistos en última hora)
 *   POST /api/visit/:deviceId    – Registrar visita a un pet
 *   POST /api/gift               – Enviar regalo
 *   GET  /api/gifts/:deviceId    – Ver regalos pendientes
 *   POST /api/gifts/:deviceId/claim – Marcar regalos como reclamados
 *   GET  /api/events/current     – Evento temporal activo
 *   POST /api/voice/transcribe   – Transcribir audio con Whisper
 *
 * Endpoints del juego web:
 *   POST /api/game/new           – Crear nuevo pet web
 *   GET  /api/game/load/:deviceId – Cargar pet guardado
 *   POST /api/game/save          – Guardar estado del pet
 */

const express = require('express');
const db      = require('./database');
const { exec } = require('child_process');
const fs        = require('fs');
const path      = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '5mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '5mb' }));

// Servir frontend estático
app.use(express.static(path.join(__dirname, '..', 'public')));
// Servir sprites
app.use('/sprites', express.static(path.join(__dirname, '..', 'sprites')));

// ─── Sync del pet ─────────────────────────────────────────────────────────────
app.post('/api/pets/sync', (req, res) => {
  const d = req.body;
  if (!d.device_id || !d.pet_name) return res.status(400).json({ error: 'Faltan campos' });

  // Upsert en tabla pets
  db.prepare(`
    INSERT INTO pets (device_id, pet_name, species, stage, evo_key, level, age_days,
                      coins, hunger, happiness, health, energy, last_seen)
    VALUES (@device_id, @pet_name, @species, @stage, @evo_key, @level, @age_days,
            @coins, @hunger, @happiness, @health, @energy, CURRENT_TIMESTAMP)
    ON CONFLICT(device_id) DO UPDATE SET
      pet_name   = excluded.pet_name,
      species    = excluded.species,
      stage      = excluded.stage,
      evo_key    = excluded.evo_key,
      level      = excluded.level,
      age_days   = excluded.age_days,
      coins      = excluded.coins,
      hunger     = excluded.hunger,
      happiness  = excluded.happiness,
      health     = excluded.health,
      energy     = excluded.energy,
      last_seen  = CURRENT_TIMESTAMP
  `).run(d);

  // Actualizar leaderboard (score = level * 100 + age_days * 10)
  const score = (d.level || 1) * 100 + (d.age_days || 0) * 10;
  db.prepare(`
    INSERT INTO leaderboard (device_id, pet_name, evo_key, level, age_days, score, updated_at)
    VALUES (@device_id, @pet_name, @evo_key, @level, @age_days, @score, CURRENT_TIMESTAMP)
    ON CONFLICT(device_id) DO UPDATE SET
      pet_name   = excluded.pet_name,
      evo_key    = excluded.evo_key,
      level      = excluded.level,
      age_days   = excluded.age_days,
      score      = excluded.score,
      updated_at = CURRENT_TIMESTAMP
  `).run({ ...d, score });

  res.json({ ok: true });
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────
app.get('/api/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT pet_name, evo_key, level, age_days, score,
           updated_at, device_id
    FROM leaderboard
    ORDER BY score DESC
    LIMIT 10
  `).all();
  res.json(rows);
});

// ─── Pets en línea ───────────────────────────────────────────────────────────
app.get('/api/pets/online', (req, res) => {
  const rows = db.prepare(`
    SELECT device_id, pet_name, species, stage, evo_key
    FROM pets
    WHERE datetime(last_seen) >= datetime('now', '-1 hour')
    ORDER BY last_seen DESC
    LIMIT 20
  `).all();
  res.json(rows);
});

// ─── Visitar pet ──────────────────────────────────────────────────────────────
app.post('/api/visit/:deviceId', (req, res) => {
  const host_id    = req.params.deviceId;
  const visitor_id = req.body.visitor_id;
  if (!visitor_id) return res.status(400).json({ error: 'visitor_id requerido' });
  if (host_id === visitor_id) return res.status(400).json({ error: 'No puedes visitarte a ti mismo' });

  db.prepare(`
    INSERT INTO visits (visitor_id, host_id) VALUES (?, ?)
  `).run(visitor_id, host_id);

  // Enviar "regalo de visita" automático al host
  db.prepare(`
    INSERT INTO gifts (from_device, to_device, type, amount)
    VALUES (?, ?, 'coins', 5)
  `).run(visitor_id, host_id);

  res.json({ ok: true, message: 'Visita registrada (+5 coins al pet visitado)' });
});

// ─── Enviar regalo ────────────────────────────────────────────────────────────
app.post('/api/gift', (req, res) => {
  const { from_device, to_device, type, amount, item_id, item_name, item_type, rarity } = req.body;
  if (!from_device || !to_device || !type) return res.status(400).json({ error: 'Faltan campos' });

  db.prepare(`
    INSERT INTO gifts (from_device, to_device, type, amount, item_id, item_name, item_type, rarity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(from_device, to_device, type,
         amount || 0, item_id || 0,
         item_name || '', item_type || 0, rarity || 0);

  res.json({ ok: true });
});

// ─── Ver regalos pendientes ────────────────────────────────────────────────────
app.get('/api/gifts/:deviceId', (req, res) => {
  const rows = db.prepare(`
    SELECT id, from_device, type, amount, item_id, item_name, item_type, rarity, created_at
    FROM gifts
    WHERE to_device = ? AND claimed = 0
    ORDER BY created_at ASC
    LIMIT 20
  `).all(req.params.deviceId);
  res.json(rows);
});

// ─── Reclamar regalos ─────────────────────────────────────────────────────────
app.post('/api/gifts/:deviceId/claim', (req, res) => {
  db.prepare(`
    UPDATE gifts SET claimed = 1
    WHERE to_device = ? AND claimed = 0
  `).run(req.params.deviceId);
  res.json({ ok: true });
});

// ─── Evento temporal activo ───────────────────────────────────────────────────
app.get('/api/events/current', (req, res) => {
  const event = db.prepare(`
    SELECT name, description, bonus_item_id
    FROM seasonal_events
    WHERE date('now') BETWEEN start_date AND end_date
    ORDER BY id DESC
    LIMIT 1
  `).get();

  if (!event) return res.json({});
  res.json(event);
});

// ─── Transcripción de voz (Whisper local) ─────────────────────────────────────
app.post('/api/voice/transcribe', (req, res) => {
  if (!req.body || req.body.length === 0) {
    return res.status(400).send('No audio');
  }

  // Guardar audio temporal
  const tmp_raw  = path.join('/tmp', `voice_${Date.now()}.raw`);
  const tmp_wav  = tmp_raw.replace('.raw', '.wav');

  fs.writeFileSync(tmp_raw, req.body);

  // Convertir PCM raw 16kHz 16bit mono → WAV con ffmpeg
  const ffmpeg_cmd = `ffmpeg -f s16le -ar 16000 -ac 1 -i ${tmp_raw} ${tmp_wav} -y 2>/dev/null`;

  exec(ffmpeg_cmd, (err) => {
    if (err) {
      fs.unlinkSync(tmp_raw);
      return res.status(500).send('');
    }

    // Transcribir con Whisper (whisper.cpp o Python whisper)
    // Requiere: `pip install openai-whisper` o `whisper.cpp` instalado
    const whisper_cmd = `whisper ${tmp_wav} --model tiny --language Spanish --output_format txt --output_dir /tmp 2>/dev/null`;

    exec(whisper_cmd, (err2) => {
      const txt_file = tmp_wav.replace('.wav', '.txt');
      let text = '';
      if (!err2 && fs.existsSync(txt_file)) {
        text = fs.readFileSync(txt_file, 'utf8').trim();
        fs.unlinkSync(txt_file);
      }
      fs.unlinkSync(tmp_raw);
      if (fs.existsSync(tmp_wav)) fs.unlinkSync(tmp_wav);

      res.send(text);
    });
  });
});

// ─── Juego Web ────────────────────────────────────────────────────────────────

// Crear nuevo pet
app.post('/api/game/new', (req, res) => {
  const { name, species } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });

  const device_id = 'web_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const pet = {
    name,
    species: parseInt(species) || 0,
    stage: 0,
    hunger: 80,
    happiness: 80,
    health: 100,
    energy: 80,
    coins: 50,
    xp: 0,
    level: 1,
    age_days: 0,
    birth_timestamp: Date.now(),
    last_tick: Date.now(),
    evolution_key: '',
    personality: {
      curiosity:    Math.floor(Math.random() * 60) + 20,
      appetite:     Math.floor(Math.random() * 60) + 20,
      energy_trait: Math.floor(Math.random() * 60) + 20,
      sociability:  Math.floor(Math.random() * 60) + 20,
      stubbornness: Math.floor(Math.random() * 60) + 20
    },
    wardrobe: { hat: -1, shirt: -1, pants: -1, shoes: -1, accessory: -1 },
    house: { bed: -1, furniture_l: -1, furniture_r: -1, decor_top: -1, wallpaper: 0, floor: 0 },
    inventory: [],
    care_play_count: 0,
    care_feed_count: 0,
    care_sleep_count: 0,
    games_played_today: 0,
    last_game_day: 0
  };

  db.prepare(`
    INSERT OR REPLACE INTO web_pets (device_id, pet_json, updated_at)
    VALUES (?, ?, unixepoch())
  `).run(device_id, JSON.stringify(pet));

  res.json({ device_id, pet });
});

// Cargar pet guardado
app.get('/api/game/load/:deviceId', (req, res) => {
  const row = db.prepare('SELECT pet_json FROM web_pets WHERE device_id = ?')
               .get(req.params.deviceId);
  if (!row) return res.status(404).json({ error: 'Pet no encontrado' });
  res.json({ device_id: req.params.deviceId, pet: JSON.parse(row.pet_json) });
});

// Guardar estado del pet
app.post('/api/game/save', (req, res) => {
  const { device_id, pet } = req.body;
  if (!device_id || !pet) return res.status(400).json({ error: 'Faltan campos' });

  db.prepare(`
    INSERT OR REPLACE INTO web_pets (device_id, pet_json, updated_at)
    VALUES (?, ?, unixepoch())
  `).run(device_id, JSON.stringify(pet));

  // Sincronizar con leaderboard
  const score = (pet.level || 1) * 100 + (pet.age_days || 0) * 10;
  db.prepare(`
    INSERT INTO leaderboard (device_id, pet_name, evo_key, level, age_days, score, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(device_id) DO UPDATE SET
      pet_name = excluded.pet_name, evo_key = excluded.evo_key,
      level = excluded.level, age_days = excluded.age_days,
      score = excluded.score, updated_at = CURRENT_TIMESTAMP
  `).run(device_id, pet.name, pet.evolution_key || '', pet.level || 1, pet.age_days || 0, score);

  res.json({ ok: true });
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`LlamaGochi Server corriendo en http://localhost:${PORT}`);
  console.log('  POST /api/game/new');
  console.log('  GET  /api/game/load/:deviceId');
  console.log('  POST /api/game/save');
  console.log('  POST /api/pets/sync');
  console.log('  GET  /api/leaderboard');
  console.log('  GET  /api/pets/online');
});
