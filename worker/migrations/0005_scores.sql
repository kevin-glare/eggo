-- Лидерборд мини-игр: лучший счёт каждого игрока в каждой игре.
-- Наполняется при каждом /sync по максимуму (апсерт идемпотентен), имя для
-- показа берётся из users.first_name (JOIN) — отдельная копия не хранится.
CREATE TABLE IF NOT EXISTS scores (
  telegram_id INTEGER NOT NULL,
  game TEXT NOT NULL,
  best INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (telegram_id, game)
);
