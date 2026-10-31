# AGENTS.md — правила проекта

Eggo — тамагочи для Telegram Mini App: фронт на GitHub Pages, API — Cloudflare
Worker + D1 (`worker/`), пуши через бота. Проект учебный: владелец изучает ZCode
и хочет понимать и править весь код сам. Полный мануал по запуску и деплою —
в `README.md`.

## Архитектура (святое)

- `src/game/` — чистая игровая логика: без React, без DOM, без localStorage.
  Только чистые функции и типы: `state → new state`, без мутаций.
- `src/ui/` — React-слой. Тонкий: рендерит состояние из `game/`, отправляет действия.
- Любое число, влияющее на баланс игры (скорости, пороги, длительности), живёт в
  `src/game/config.ts`, а не внутри логики.
- Новые фичи игры не должны требовать импорта React из `src/game/`.
- Воркер (`worker/src/`) импортирует `src/game/*` — ядро общее для фронта и бэка.

## Карта проекта

`src/game/`:
- `types.ts` — Stage, Mood, Stats, PetState.
- `config.ts` — «пульт баланса»: распад статов, сон, критичность, эволюция,
  действия, квесты, стрики, пуши; `DEFAULT_CONFIG` и `DEV_CONFIG` (время ×60).
- `engine.ts` — createPet, tick, getMood, desire.
- `actions.ts` — feed/play/wash/pet/сон/имя → `ActionResult{ok, reason}`.
- `storage.ts` — serialize/deserialize, catchUp (досчёт оффлайна), mergeRemoteSave.
- `quests.ts`, `streak.ts` — дневные задания и серия дней.
- `appearance.ts` — «гены» внешности питомца.
- `notifications.ts` — какие пуши пора слать (решение; отправка — в воркере).
- `holidays.ts` — праздничные окна: какая тема оформления активна сегодня.

`src/` (React-слой):
- `usePet.ts` — главный хук-владелец состояния: сейвы (localStorage +
  CloudStorage + сервер), тик раз в секунду, действия, автосинк.
- `PetCanvas.tsx` — канвас-сцена с GSAP-твинами (сценки действий, торт, грязь).
- `hints.ts` — одноразовые подсказки до первого успеха (флаги в localStorage,
  не в сейве).
- `App.tsx`, `CreatePetScreen.tsx`, `ActionsBar.tsx`, `StatsBar.tsx`,
  `QuestsBar.tsx` — экран и панели.
- `scene.ts`, `dayCycle.ts`, `dirt.ts`, `petArt.ts` — фон, небо по времени
  суток, грязь сцены, отрисовка питомца.
- `holidays.ts` + `themes/` — реестр праздничных тем и их арт; новая тема =
  файл в `themes/` + строка реестра, окно и выключатель — в `config.ts`
  (`holidays`), отладка — `VITE_HOLIDAY_THEME=<id>|off`.

`worker/src/`: `index` (роутер /sync, /notify + крон), `auth` (проверка
Telegram initData), `sync` (слияние по lastTickAt), `repo` (D1), `pushes`
(крон пушей), `telegram-api`. Миграции — `worker/migrations/`.

Тесты: `tests/` — игровое ядро и воркер (через fake D1).

## Команды

```bash
npm run dev        # фронт (localhost:5173, время ×60)
npm test           # vitest
npm run build      # tsc + vite build
npm run worker:dev # API локально (:8787)
npm run worker:migrate && npm run worker:deploy   # прод API
```

## Поток данных

Тап → `usePet` вызывает чистую функцию из `game/actions.ts` → `{state, ok, reason}`:
отказ — тост, успех — setPet → localStorage + `POST /sync` (слияние по lastTickAt).
Тик раз в секунду: catchUp + tick + ensureDaily. Крон воркера досчитывает тот же
PetState из D1 и решает (`game/notifications.ts`), слать ли пуш в Telegram.

## Паттерны проекта

- Запреты действий — guard в движке (`ActionResult.reason`) + тост в UI;
  кнопки не дизейблятся.
- Новая механика должна самообъясняться: подсказка до первого успеха
  (`src/ui/hints.ts`).
- Новое поле PetState → нормализация в deserialize для старых сейвов; ключ сейва
  `tamagotchi.save.v1` не менять без миграции.
- CI-раннеры в UTC: TZ-зависимые тесты гонять с `TZ=UTC`.
- Визуал в IAB скриншотами не проверяется — геометрия DOM и `getImageData`.

## Код

- TypeScript strict, без `any`.
- Всё в `src/game/**` покрывается юнит-тестами (Vitest). Новая логика = новый тест,
  тест пишется до реализации, когда задача это позволяет.
- UI-тексты на русском.

## Процесс

- Один этап плана = один коммит. Перед следующим этапом владелец ревьюит diff
  (`git show` / «покажи diff»).
- Коммиты маленькие, на русском, заголовок — что сделано.
- `git push` не делать без явной просьбы владельца.
- Установку новых зависимостей согласовывать с владельцем.
