---
name: deploy
description: Деплой и релиз Eggo — публикация фронта (GitHub Pages через CI), обновление API-воркера (Cloudflare wrangler), миграции D1, секреты бота, проверка прод-состояния. Использовать, когда владелец просит задеплоить, выпустить, обновить воркер или проверить прод.
---

# Деплой Eggo

## Перед релизом

- `npm test` — локально, TZ-зависимые тесты гонять с `TZ=UTC`
  (CI-раннеры в UTC, плавающие тесты = красный деплой).
- Хостинг только бесплатный (GitHub Pages + Cloudflare Workers/D1) — платные
  опции не предлагать без явного запроса.

## Фронт — GitHub Pages, автоматически

Пуш в `main` запускает `.github/workflows/deploy.yml`:
`npm ci → npm test → npm run build (VITE_API_URL из repo Variables) → Pages`.

- **`git push` делать только по явной просьбе владельца** — это и есть публикация.
- После пуша проверить: Actions зелёный, мини-апп открывается.

## API — Cloudflare Worker + D1 (worker/)

```bash
npm run worker:migrate   # новые миграции из worker/migrations/ (при наличии)
npm run worker:deploy    # публикация воркера (api.eggotg.ru)
```

- Новая миграция = новый файл `worker/migrations/000N_*.sql`; менять старые
  нельзя. Миграция применяется и локально (`worker:migrate:local`).
- Секрет бота: `npx wrangler secret put BOT_TOKEN` (локально — `worker/.dev.vars`,
  не коммитится).
- CORS: `ALLOWED_ORIGIN` в `worker/wrangler.toml` — адрес мини-аппа на Pages.
- Домен: бесплатный `*.workers.dev` заблокирован в РФ, поэтому свой
  `api.eggotg.ru`; ECH в зоне Cloudflare выключен.

## После деплоя воркера

- `POST /sync` отвечает и сохраняет сейв (проверить из мини-аппа).
- Крон пушей: каждые 30 мин, шлёт максимум одно важнейшее уведомление,
  тихие часы 22–9 по utc_offset пользователя.
- Пуши доходят только если пользователь запустил бота (кнопка «Запустить»).
