/**
 * Tamagotchi Next Level – Backend Social
 *
 * Endpoints:
 *   POST /api/pets/sync          – Subir estado del pet al leaderboard
 *   GET  /api/leaderboard        – Top 10 pets
 *   GET  /api/pets/online        – Pets en línea (vistos en última hora)
 *   POST /api/visit/:deviceId    – Registrar visita a un pet
 *   POST /api/gift               – Enviar regalo
 *   GET  /api/gifts/:deviceId    – Ver regalos pendientes
 *   POST /api/gifts/:deviceId/claim – Marcar regalos como reclamados
 *   GET  /api/events/current     – Evento temporal activo
 *   POST /api/voice/transcribe   – Transcribir audio con Whisper
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

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Tamagotchi Server corriendo en http://localhost:${PORT}`);
  console.log('Endpoints disponibles:');
  console.log('  POST /api/pets/sync');
  console.log('  GET  /api/leaderboard');
  console.log('  GET  /api/pets/online');
  console.log('  POST /api/visit/:deviceId');
  console.log('  POST /api/gift');
  console.log('  GET  /api/gifts/:deviceId');
  console.log('  POST /api/gifts/:deviceId/claim');
  console.log('  GET  /api/events/current');
  console.log('  POST /api/voice/transcribe');
});
