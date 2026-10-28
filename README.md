# Eggo — Telegram Mini App

Светящийся питомец, о котором заботишься в Telegram. Учебный проект:
React + TypeScript + Vite, Canvas-сцена с GSAP-анимациями, чистое игровое
ядро без UI-зависимостей. Сцена живёт по локальному времени: небо над
питомцем меняется от рассвета к дню, закату и ночи.

Сейв питомца синхронизируется с нашим API (Cloudflare Worker + D1),
а бот присылает пуши, если питомец в беде, вырос или заскучал.

## Запуск

```bash
npm install
npm run dev               # дев-сервер с горячей перезагрузкой
npm test                  # юнит-тесты (игровое ядро + воркер)
npm run build             # проверка типов + продакшен-сборка в dist/

# API-воркер (нужен для синка сейва и пушей):
npm run worker:migrate:local   # локальная база D1 (один раз)
npm run worker:dev             # воркер на http://localhost:8787
npm run worker:metrics         # отчёт по игрокам из прод-базы (DAU, приток, стадии)
```

Метрики и планы роста — в `docs/ROADMAP.md`, чеклист запуска (оформление бота,
каталоги) — в `docs/launch-kit.md`.

Для проверки пушей локально положите тестовый токен бота в `worker/.dev.vars`:

```
BOT_TOKEN="123456:TEST-TOKEN"
```

Вне Telegram (просто в браузере) всё работает на localStorage: синк и пуши
безопасно выключаются.

## Как устроено

- `src/game/` — вся игровая логика (чистые функции, 100% под тестами):
  `config.ts` хранит все числа баланса, `notifications.ts` решает, какие
  пуши отправить. Ядро не знает ни про React, ни про хранилища.
- `src/ui/` — React: экран, полоски статов, кнопки, Canvas с питомцем.
- `src/telegram.ts` — интеграция с Telegram (тема, хаптика, синк с сервером);
  вне Telegram безопасно выключается.
- `worker/` — Cloudflare Worker: проверка Telegram `initData` (HMAC),
  `POST /sync` со слиянием сейвов по `lastTickAt` (клиент — источник правды,
  сервер хранит сейв и досчитывает время тем же движком), `GET/POST /notify`
  для подписки, крон каждые 30 минут шлёт пуши через Bot API.

Правила работы с кодом — в `AGENTS.md`.

## Развёртывание

### Фронт — GitHub Pages (автоматически)

1. Создайте репозиторий на GitHub и запушьте код (ветка `main`).
2. В настройках репозитория: **Settings → Pages → Source: GitHub Actions**.
3. Там же: **Settings → Secrets and variables → Actions → Variables** —
   добавьте `VITE_API_URL` = адрес воркера, например `https://api.ваш-домен.ру`.
4. Дальше каждый пуш в `main` сам собирает и публикует фронт
   (воркфлоу `.github/workflows/deploy.yml`).

### API — Cloudflare Worker + D1

Домен обязателен: бесплатный `*.workers.dev` заблокирован в РФ, свой домен
(подойдёт `.ru`) открывается нормально. Платный план не нужен.

1. **Домен**: купите, добавьте зону в Cloudflare и в её настройках выключите
   **ECH** (Network → Encrypted Client Hello). Поддомен для API (например
   `api.ваш-домен.ру`) привяжите к воркеру.
2. **База**: `npx wrangler d1 create eggo` → впишите выданный `database_id`
   в `worker/wrangler.toml`.
3. **Секрет бота**: возьмите токен у @BotFather и выполните
   `npx wrangler secret put BOT_TOKEN` (для локальной проверки — в
   `worker/.dev.vars`).
4. **CORS**: в `worker/wrangler.toml` сузьте `ALLOWED_ORIGIN` до адреса
   мини-аппа на GitHub Pages.
5. **Публикация**: `npm run worker:migrate` (один раз) и `npm run worker:deploy`.

### Мини-апп в Telegram

1. У @BotFather: `/newbot` (если бота ещё нет) → сохранить токен.
2. **Bot Settings → Menu Button** (или `/newapp`): укажите URL мини-аппа —
   адрес страницы на GitHub Pages. Бот должен быть запущен пользователем
   (кнопка «Запустить»), иначе пуши приходить не будут — приложение само
   подскажет это при включении уведомлений.
