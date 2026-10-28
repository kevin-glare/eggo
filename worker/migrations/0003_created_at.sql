-- Дата первой встречи с игроком (мс): с ней worker/metrics.sql считает
-- приток новых по дням и удержание. Для старых рядов лучшая имеющаяся
-- оценка знакомства — updated_at.
ALTER TABLE users ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
UPDATE users SET created_at = updated_at WHERE created_at = 0;
