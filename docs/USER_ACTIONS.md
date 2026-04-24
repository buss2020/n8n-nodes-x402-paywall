# Действия, которые должен выполнить user (не автоматизируется)

Последнее обновление: 2026-04-24

Автономный Claude выполняет код, деплой, тесты, доки. Следующие пункты требуют **твоих рук**.

---

## 🔴 Task 13.5 — Screencast tx через Circle Developer Console (обязательно для видео)

**Требование хакатона:** в демо-видео должна быть транзакция **исполненная через Circle Developer Console** + её верификация в Arc Block Explorer.

**Зачем:** наши 50+ x402-бурст транзакций идут через self-hosted facilitator на VPS → они лягут в Arc Explorer, но НЕ появятся в Circle Console (Console не смотрит за произвольными EVM-адресами). Одна tx, исполненная через Console UI, закрывает это требование.

### Пошагово (~15 минут)

1. **Открой Circle Developer Console:** https://console.circle.com (ты уже залогинен)
2. **Убедись что Sandbox режим** — переключатель обычно в правом верхнем углу
3. **Запусти QuickTime screen recording:** `Cmd+Shift+5` → "Record Selected Portion" → выбрать окно браузера
4. **Левое меню → Wallets** → Create Developer Controlled Wallet
   - Blockchain: **Arc Testnet** (если в дропдауне нет — выбирай любую EVM testnet, например Base Sepolia; в Product Feedback объясним)
   - Walletset: new
   - Save the Entity Secret → сохрани в надёжное место (не в чат)
5. **Faucet** — вверху слева есть пункт Faucet → получить testnet USDC на адрес новосозданного Wallet'а
6. **Вернись в Wallets → твой кошелёк → `Transfer` (или `Send`)**
   - Recipient: `0x8F79711f72D92C642D28bA776C8C1F3302a529D4` (наш payTo)
   - Amount: `0.01 USDC` (ровно 0.01, чтобы попасть в требование «≤ $0.01 per action»)
   - Sign + Submit
7. **Дождись появления transaction hash** (появится в истории tx в Console)
8. **Клик на tx hash → он откроется в Arc Block Explorer** (`testnet.arcscan.app/tx/<hash>`)
   - Покажи confirmed статус
   - Покажи USDC transfer event
9. **Остановить QuickTime recording** (Cmd+Shift+5 → Stop)
10. **Сохранить файл как** `/Users/nikolajmiheev/Claude-Vadim-ARC-n8n/assets/screencaps/circle-console-tx.mov`

**Если папки нет:** `mkdir -p /Users/nikolajmiheev/Claude-Vadim-ARC-n8n/assets/screencaps`

**Результат:** 60-90-секундный screencast — ингредиент для финального видео.

---

## 🔴 Task 15 — Собрать финальное демо-видео (≤5 мин, ≤300 MB)

Мой вклад: подготовлю screen-записи для каждого сегмента + script + pitch deck.
Твой вклад: смонтировать в CapCut / iMovie / Keynote.

Материалы для монтажа (будут в `assets/screencaps/` и `assets/`):
- `circle-console-tx.mov` — твой Task 13.5 screencast (~60-90s)
- `node-config.mov` — я запишу отдельно (UI n8n + curl 402)
- `burst-50.mov` — терминал во время burst'а (~2 min)
- `pitch-deck.pdf` — слайды для intro/outro

Сценарий (в `docs/VIDEO_SCRIPT.md`):
- 0:00–0:40 — Intro + problem (title slide + stripe pricing)
- 0:40–1:40 — Circle Console → Arc Explorer (твой screencast)
- 1:40–2:20 — n8n node UI (мой)
- 2:20–3:00 — burst demo (мой)
- 3:00–3:30 — close

Таргет ≤5 мин → у нас запас. Экспорт: 1080p, H.264, <250 MB.

Upload куда: YouTube unlisted предпочтительно (submission form — это link-поле, не file upload).

---

## 🟡 Track decision (решение блокирует submission form, но не код)

Audit показал: треков **5, не 3**. Варианты:

- **Best Autonomous Commerce Application** (изначально выбрано; наш 2-agent loop идеально попадает)
- **Best Dev Tools** (n8n community node = dev tool буквально; может быть менее конкурентный трек)

Рекомендация: **Best Autonomous Commerce Application** — наш демо больше про commerce (buyer workflow → seller workflow → USDC flow), чем про голый dev-tool. Но если увидим что Dev Tools трек менее насыщен — можно подать туда.

Решать перед submission. Пиши в чат или на submission form ты выбираешь сам.

---

## 🟢 Submission form на lablab.ai

Когда все артефакты готовы, ты заполняешь форму:

1. Title: "n8n X402 Paywall — One Node, Paid Workflows"
2. Short description (≤255 chars): готовится в README pitch section
3. Cover image: upload `assets/cover.png` (агент готовит)
4. Full description: paste из README
5. Tech tags: pick "Arc", "USDC", "Nanopayments", "x402", "n8n" (если есть в каталоге)
6. GitHub URL: `https://github.com/buss2020/n8n-nodes-x402-paywall`
7. Demo URL: `https://2.26.21.34/webhook/x402-demo` (live endpoint)
8. Video: YouTube unlisted link
9. Pitch deck: upload `assets/pitch-deck.pdf`
10. Challenge track: Best Autonomous Commerce Application
11. Circle Product Feedback: paste из `docs/CIRCLE_FEEDBACK.md`
12. Team: Nikolay Micheev + Vadim Buss (`NikolayMicheev` и `buss2020` оба должны быть в lablab team)

---

## Открытые вопросы

- Нужен ли второй wallet для burst (чтобы client ≠ merchant)? Сейчас client=merchant=`0x8F79...`. Работает, но «commerce между агентами» требует 2 разных адреса. **Решить:** оставить как есть с пояснением в README, или усложнить.
- Оба ли member'а (NikolayMicheev + buss2020) уже в одной lablab team? — **проверить в UI**.
