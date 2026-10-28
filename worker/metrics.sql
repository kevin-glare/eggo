-- Отчёт по игрокам Eggo из прод-базы: приток, активность, удержание, стадии.
-- Запуск: npm run worker:metrics
-- Время в базе хранится в миллисекундах, поэтому перед unixepoch() делим на 1000.

-- Всего игроков.
SELECT COUNT(*) AS players_total FROM users;

-- Активность за сутки / неделю / месяц.
SELECT COUNT(*) AS dau_24h FROM users
WHERE last_seen_at >= (unixepoch() - 86400) * 1000;

SELECT COUNT(*) AS wau_7d FROM users
WHERE last_seen_at >= (unixepoch() - 7 * 86400) * 1000;

SELECT COUNT(*) AS mau_30d FROM users
WHERE last_seen_at >= (unixepoch() - 30 * 86400) * 1000;

-- Приток новых по дням: последние 14 дней с данными.
-- Для рядов до миграции 0003 created_at = updated_at, их дни приблизительные.
SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS new_players
FROM users
WHERE created_at > 0
GROUP BY day
ORDER BY day DESC
LIMIT 14;

-- Удержание: из тех, кто пришёл больше 2 дней назад, доля, кто играл дольше двух дней.
SELECT COUNT(*) AS cohort,
       SUM(last_seen_at - created_at >= 2 * 86400 * 1000) AS stayed_2d
FROM users
WHERE created_at <= (unixepoch() - 2 * 86400) * 1000;

-- То же для недели.
SELECT COUNT(*) AS cohort,
       SUM(last_seen_at - created_at >= 7 * 86400 * 1000) AS stayed_7d
FROM users
WHERE created_at <= (unixepoch() - 7 * 86400) * 1000;

-- Воронка стадий: как далеко добираются игроки (NULL — не было синка с сейвом).
SELECT COALESCE(stage, 'нет синка') AS stage, COUNT(*) AS players
FROM users
GROUP BY stage
ORDER BY players DESC;

-- Здоровье пушей: bot_blocked = 1 — игрок заблокировал бота, отток канала удержания.
SELECT bot_blocked AS bot_blocked, COUNT(*) AS players
FROM users
GROUP BY bot_blocked;
