-- Кто пригласил игрока (telegram_id пригласившего; 0 — никто).
-- Заполняется из подписанного start_param=ref_<id> при первой записи ряда;
-- позже сознательно не меняется — первый пригласивший фиксируется навсегда.
ALTER TABLE users ADD COLUMN referrer_tg_id INTEGER NOT NULL DEFAULT 0;
