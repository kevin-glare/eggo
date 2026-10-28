-- Пользователи: один ряд на игрока, сейв лежит целиком в save_json (~0,4 КБ).
-- stage — стадия на момент последнего синка: крон сравнит с досчитанной и увидит взросление.
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  save_json TEXT,
  stage TEXT,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  bot_blocked INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- Отправленные уведомления: kind включает признак повтора,
-- например 'critical', 'grown:child', 'missYou'.
CREATE TABLE IF NOT EXISTS notifications (
  telegram_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (telegram_id, kind)
);
