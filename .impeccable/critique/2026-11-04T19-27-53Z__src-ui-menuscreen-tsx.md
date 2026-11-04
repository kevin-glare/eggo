---
target: экран меню (MenuScreen)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/kevinglare/project/zcode/src/ui/MenuScreen.tsx"
target_fingerprint: "sha256:70c1b612c57425bf5925f28225b9b4ab388c825464cbdd64a2e7d40a6f8f7ff5"
target_path: /Users/kevinglare/project/zcode/src/ui/MenuScreen.tsx
timestamp: 2026-11-04T19-27-53Z
slug: src-ui-menuscreen-tsx
---
# Критика: экран меню Eggo (src/ui/MenuScreen.tsx)

Method: dual-agent (A: agent_26a89f48 · B: agent_c9cc378e). Браузерная визуализация пропущена: цель — исходники; рендер-правила детектора требуют запущенного dev-сервера (Run Notes).

## Design Health Score — 30/40 (Good)

| # | Эвристика | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Тосты тумблера пушей рендерятся за оверлеем меню |
| 2 | Match System / Real World | 4 | Тексты отличные: «Позови друга», плюрализации |
| 3 | User Control and Freedom | 3 | ✕/←/Escape есть; нет swipe-down и Telegram BackButton |
| 4 | Consistency and Standards | 2 | Ряды-тумблеры и ряды-навигация неразличимы; два exit-идиома |
| 5 | Error Prevention | 3 | Смена языка — мгновенный необратимый reload без подтверждения |
| 6 | Recognition Rather Than Recall | 3 | Всё подписано; шевронов навигации нет |
| 7 | Flexibility and Efficiency | 2 | Escape — только desktop |
| 8 | Aesthetic and Minimalist Design | 4 | 5–6 рядов, две секции, ноль шума |
| 9 | Error Recovery | 2 | notifBlocked/notifError невидимы в контексте меню |
| 10 | Help and Documentation | 3 | 6 строк правил в 2 тапах от корня |
| **Total** | | **30/40** | **Good** |

## Design Specificity Verdict

Категориальный каркас, одетый в фирменный материал: стандартный settings-list (uppercase-секции, ряды «иконка+подпись», версия в футере). Материал безупречен — токены глянца, Comfortaa, слайд 240ms, золото только на состоянии и CTA. Но ни одного элемента мира (питомца, неба): глянцевая система работает вполсилы. Эмодзи-иконки — честно для Telegram-игрушки, но единственные «некрафтовые» объекты.

Детерминированный скан: 0 находок (exit 0) по 22 файлам src/ui — но это только pattern-правила; rendered-правила (контраст, мелкий текст) требуют URL-скана. Overcount-риска нет; false positives нет.

## Что работает
1. Материальная целостность — всё на токенах глянца, ничего не выбивается.
2. IA-дисциплина — «Настройки»/«Ещё», условные ряды, подэкраны вместо свалки.
3. Дисциплина акцента — золото только на состоянии, милстоунах и единственном CTA.

## Priority Issues
- **[P0] Тосты тумблера пушей невидимы в меню.** Тост уходит в toast-slot внутри .scene-card (App.tsx), оверлей .menu-root z-index:30 с непрозрачным фоном. Успех И ошибка включения/выключения пушей не видны в момент действия. Фикс: рендерить notifNotice внутри .menu-screen или поднять слот выше z-30. Команда: /impeccable polish (адресно).
- **[P1] Тач-таргеты < 44px.** .tool-btn 30px, .menu-row/.invite-share ≈38px. Casey (одна рука) промахивается; ✕ в правом верхнем углу — худшая зона большого пальца. Фикс: min-height 44px на .menu-row/.invite-share, hit-area для .tool-btn. Команда: /impeccable adapt.
- **[P1] Диалог без focus management.** aria-modal=true, но фокус не переносится, не запирается, не возвращается на ☰. Фикс: focus на open, trap Tab, restore на close. Команда: /impeccable harden.
- **[P2] Анатомия рядов не кодирует поведение.** Тумблер и навигация выглядят одинаково. Фикс: шеврон «›» на навигационных рядах, state-dot — только у пушей. Команда: /impeccable polish.
- **[P2] Двойной exit + Telegram BackButton не задействован.** ✕ и ← рядом с разным scope. Фикс: убрать ✕ из подэкранов, tg.BackButton (show на open, onClick = back/close). Команда: /impeccable harden.

## Персоны
**Jordan (новичок):** смена языка → reload → вспышка «Загружаем питомца…» читается как потеря питомца; ряды-тумблер и ряды-навигация выглядят одинаково; задизейбленный ряд без объяснения.
**Casey (мобильный, одна рука):** ✕ 30px в верхней зоне; .menu-row ≈38px (<44); нет swipe-down и Telegram BackButton — единственный выход на мобиле — верхний угол; чипы-милстоуны ~22px с tooltip, недоступным на тач.

## Minor
- ✕ панелей без hapticTap (MenuScreen оборачивает ряды, панели — нет).
- Смена языка reload'ом — flash «Загружаем питомца…».
- prefers-reduced-motion глушит слайд целиком — можно заменить на fade.
- Меню-профиль без мини-арта питомца — единственная поверхность без элемента мира.

## Questions to Consider
- Почему самый «игровой» экран продукта — единственная поверхность без элемента мира?
- Если ✕ и «Назад» значат разное, почему выглядят одинаково?
- Чем должен кончаться возврат в игру — закрытие меню тоже сцена?
