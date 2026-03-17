const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'tamagotchi.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS pets (
    device_id   TEXT PRIMARY KEY,
    pet_name    TEXT NOT NULL,
    species     INTEGER DEFAULT 0,
    stage       INTEGER DEFAULT 0,
    evo_key     TEXT DEFAULT '',
    level       INTEGER DEFAULT 1,
    age_days    INTEGER DEFAULT 0,
    coins       INTEGER DEFAULT 0,
    hunger      INTEGER DEFAULT 80,
    happiness   INTEGER DEFAULT 80,
    health      INTEGER DEFAULT 100,
    energy      INTEGER DEFAULT 80,
    last_seen   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    device_id   TEXT PRIMARY KEY,
    pet_name    TEXT NOT NULL,
    evo_key     TEXT DEFAULT '',
    level       INTEGER DEFAULT 1,
    age_days    INTEGER DEFAULT 0,
    score       INTEGER DEFAULT 0,
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gifts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    from_device TEXT NOT NULL,
    to_device   TEXT NOT NULL,
    type        TEXT NOT NULL,   -- 'coins' | 'item'
    amount      INTEGER DEFAULT 0,
    item_id     INTEGER DEFAULT 0,
    item_name   TEXT DEFAULT '',
    item_type   INTEGER DEFAULT 0,
    rarity      INTEGER DEFAULT 0,
    claimed     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS seasonal_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_date  TEXT NOT NULL,
    end_date    TEXT NOT NULL,
    bonus_item_id INTEGER DEFAULT -1
  );

  CREATE TABLE IF NOT EXISTS visits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id  TEXT NOT NULL,
    host_id     TEXT NOT NULL,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insertar evento de ejemplo si no existe
const existingEvent = db.prepare("SELECT COUNT(*) as c FROM seasonal_events").get();
if (existingEvent.c === 0) {
  db.prepare(`
    INSERT INTO seasonal_events (name, description, start_date, end_date)
    VALUES ('Primavera', 'Flores y mariposas especiales!', '2026-03-01', '2026-05-31')
  `).run();
}

module.exports = db;
