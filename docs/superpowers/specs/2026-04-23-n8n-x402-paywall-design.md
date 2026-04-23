# n8n X402 Paywall Node — Design Spec

**Дата:** 2026-04-23
**Автор:** Николай Михеев + Claude Code
**Проект:** Submission на хакатон Agentic Economy on Arc — Nano-Payments (LabLab × Circle × Arc)
**Сабмит deadline:** 2026-04-25
**Репо:** `github.com/NikolayMicheev/n8n-nodes-x402-paywall` (создаётся в Day 0)
**Лицензия:** MIT

---

## 1. Цель и контекст

Собрать production-quality **community-node для n8n**, превращающую любой workflow в платный HTTP-endpoint через протокол **x402** с расчётами в **USDC на Arc testnet**. Готовую к публикации в n8n community, но публиковать в рамках хакатона не обязательно.

**Submission track:** *Best Autonomous Commerce Application* (с побочным попаданием на *Best Gateway-Based Micropayments Integration* через использование Nanopayments/Gateway через x402 facilitator).

**Мандатные требования хакатона, которые закрывает проект:**
- Per-action pricing ≤ $0.01 — ставим `$0.005` по умолчанию
- 50+ on-chain транзакций в демо — обеспечивает `scripts/burst-50.ts`
- Транзакции видны в Circle Developer Console — evidence из Console скриншотами
- Транзакции видны в Arc Block Explorer — ссылки на каждый txHash
- Margin story — почему Stripe/ACH/wire нерентабельны при $0.005 — в презентации слайд 8 + в README
- Circle Product Feedback — отдельный драфт (см. §6.3)

**Почему именно такой проект:**
- n8n — родной стек автора, low-code коммьюнити (~800K users) — это multiplier поверх прямых developer-интеграций Circle
- Receiver-нода проще Payer-варианта за 2 дня: нет работы с private key, меньше failure modes
- 2-agent autonomous loop возникает органично через `burst-50.ts` → живая иллюстрация требования «2+ agents autonomously settle payments»

---

## 2. Архитектура (high-level)

### 2.1 Структура пакета

```
n8n-nodes-x402-paywall/
├── credentials/
│   └── X402PaywallApi.credentials.ts
├── nodes/
│   └── X402Paywall/
│       ├── X402Paywall.node.ts
│       ├── X402Paywall.node.json
│       ├── x402.svg
│       ├── paymentRequirements.ts
│       ├── facilitatorClient.ts
│       └── types.ts
├── scripts/
│   └── burst-50.ts
├── test/
│   ├── paymentRequirements.test.ts
│   ├── facilitatorClient.test.ts
│   └── integration.test.ts
├── assets/
│   ├── presentation.pdf
│   ├── burst-50-evidence.json
│   └── screenshots/
├── package.json
├── tsconfig.json
├── LICENSE              # MIT
└── README.md
```

### 2.2 Внешние зависимости (runtime)

- **n8n** ≥ 1.40 (self-hosted)
- **x402 facilitator** — default `https://x402.org/facilitator`, конфигурируется per credential
- **Arc testnet** — chain для settlement. Chain ID + RPC URL + USDC contract address подставляются автоматически из выбранного `Network` в UI (fallback — custom eip155:chainId)
- **Клиент** — любой HTTP-клиент с поддержкой x402 (`@x402/fetch` library или наш burst-50 скрипт)

### 2.3 Границы зон ответственности (что НЕ делаем)

- Не держим private keys — ни для себя, ни для клиента
- Не пишем в chain напрямую — facilitator settles за нас
- Не валидируем подпись локально — доверяем facilitator'у как trusted oracle x402-модели
- Не делаем webhook registration во внешних системах (facilitator не знает о нашей ноде заранее)
- Не делаем rate-limiting / TLS — это слой ниже (Cloudflare / nginx перед n8n)

### 2.4 Три потока взаимодействия (высокоуровнево)

**Поток A — unpaid request:** Client → GET → node читает headers → нет `PAYMENT-SIGNATURE` → 402 + `PAYMENT-REQUIRED` base64 JSON → workflow НЕ триггерится.

**Поток B — paid request (happy path):** Client (подписал) → GET + `PAYMENT-SIGNATURE` → node декодирует payload → facilitator `/verify` → `/settle` → Arc finality < 1s → node триггерит workflow с payment metadata → 200 + `PAYMENT-RESPONSE` header + workflow output в body.

**Поток C — error:** Невалидная подпись → 402 с error; `/settle` fail → 502 с error; facilitator down → 504.

---

## 3. API ноды (что видит user в n8n UI)

### 3.1 Основные поля

| Поле | Тип | Default | Назначение |
|------|-----|---------|-----------|
| Credentials | ref | — | `X402 Paywall API` (payTo, facilitator URL, optional API key) |
| HTTP Method | select | `GET` | Какой HTTP-метод принимаем |
| Path | string | auto | Suffix webhook URL — генерит n8n |
| Price Amount | number | `0.005` | Цена в долларах (USDC, 6 decimals) |
| Network | select | `Arc Testnet` | `Arc Testnet` / `Base Sepolia` / `Arc Mainnet` / `Custom (eip155:chainId)` |
| USDC Contract | string | auto | Подставляется из Network, override возможен |
| Resource Description | string | `Paid API endpoint` | Показывается клиенту в 402 |
| MIME Type | string | `application/json` | Content-Type успешного ответа |
| Max Timeout Seconds | number | `300` | Сколько секунд клиенту на подпись |
| Response Mode | select | `Last Node` | `Last Node` (возвращаем output последней ноды) / `On Received` (ack сразу, workflow async) |

### 3.2 Advanced (collapsed)

| Поле | Тип | Default | Назначение |
|------|-----|---------|-----------|
| Scheme | select | `exact` | `exact` / `upto` (в MVP только `exact`) |
| Facilitator URL Override | string | — | Per-node override (обычно берётся из credentials) |
| Skip Settlement | boolean | `false` | Только verify, без /settle — для тестов |
| Custom Payment Requirements Extra | JSON | `{}` | Произвольные поля в `extra` блоке |

### 3.3 Credentials schema

```typescript
class X402PaywallApi implements ICredentialType {
  name = "x402PaywallApi";
  displayName = "X402 Paywall API";
  properties = [
    { displayName: "Pay-To Address", name: "payToAddress", type: "string", required: true },
    { displayName: "Facilitator URL", name: "facilitatorUrl", type: "string", default: "https://x402.org/facilitator" },
    { displayName: "Facilitator API Key", name: "facilitatorApiKey", type: "string", typeOptions: { password: true }, default: "" },
  ];
}
```

### 3.4 Output в downstream workflow

```json
{
  "headers": { ... },
  "body": { ... },
  "query": { ... },
  "params": { ... },
  "payment": {
    "txHash": "0x...",
    "payer": "0x...",
    "amount": "5000",
    "amountUsd": "0.005",
    "network": "eip155:<arcChainId>",
    "asset": "0x<USDC>",
    "settledAt": "2026-04-25T14:23:00Z",
    "facilitator": "https://x402.org/facilitator"
  }
}
```

---

## 4. Жизненный цикл и sequence diagrams

### 4.1 Activation

User активирует workflow → n8n зовёт `webhookMethods.default.create()` → мы ничего не делаем во внешних системах → n8n регистрирует endpoint `https://<n8n-host>/webhook/<uuid>` в routing.

### 4.2 Sequence — paid happy path

```
Client            X402Paywall            Facilitator         Arc chain
  │                   │                       │                  │
  │─GET+sig──────────▶│                       │                  │
  │                   │─POST /verify─────────▶│                  │
  │                   │◀─{valid:true}─────────│                  │
  │                   │─POST /settle─────────▶│                  │
  │                   │                       │─submit tx──────▶│
  │                   │                       │◀─finality <1s───│
  │                   │◀─{txHash, payer, amt}─│                  │
  │                   │─trigger workflow      │                  │
  │                   │  output = {hdrs,body, │                  │
  │                   │   payment:{...}}      │                  │
  │◀──200 + PAYMENT-RESPONSE + body──         │                  │
```

### 4.3 Deactivation

User деактивирует → `webhookMethods.default.delete()` → no-op (внешних регистраций не было) → n8n снимает endpoint.

---

## 5. Error handling, edge cases, observability

### 5.1 Таблица ошибок

| # | Ситуация | HTTP | Workflow triggered |
|---|---------|------|---------------------|
| 1 | Нет PAYMENT-SIGNATURE | 402 | ❌ |
| 2 | Base64 invalid | 400 | ❌ |
| 3 | Facilitator /verify → valid:false | 402 | ❌ |
| 4 | /verify timeout | 504 | ❌ |
| 5 | /verify 5xx | 502 | ❌ |
| 6 | /settle timeout (после успешного /verify) | 504 | ❌ |
| 7 | /settle onchain fail | 502 | ❌ |
| 8 | Workflow упал после успешного /settle | 200 + error в body | ✅ (частично) |

**Ключевой принцип:** если платёж settled, клиент ДОЛЖЕН знать txHash — всегда возвращаем `PAYMENT-RESPONSE` header даже при 500 от workflow. Refund политика — вне кода, документируется в README.

### 5.2 Replay protection

Делегируем facilitator'у (x402 `exact` scheme содержит nonce в EIP-712 подписи). Локального кеша не ведём.

### 5.3 Concurrency

Каждый webhook — независимый контекст в n8n event loop. Нет разделяемого state → нет race conditions. Connection pool через встроенный undici/fetch.

### 5.4 Timeouts

- `/verify` — 10s
- `/settle` — 30s (учитывая finality + сеть)
- Оба переопределяются через Advanced UI.

### 5.5 Observability

`this.logger.info/warn/error` с префиксом `[X402Paywall]` и структурированным контекстом:
- `402 issued path=X reason=no_signature`
- `verified payer=0x... amount=5000 nonce=0x...`
- `settled txHash=0x... durationMs=823`
- `error stage=settle reason="..."`

### 5.6 Что НЕ защищаем

- Rate limiting — слой Cloudflare / nginx
- TLS — reverse proxy
- Private key management — не наша зона

---

## 6. Тестирование

### 6.1 Приоритеты

| Компонент | Coverage | Почему |
|-----------|----------|--------|
| `paymentRequirements.ts` | Unit tests (required) | Pure function, ошибка ломает всё |
| `facilitatorClient.ts` | Unit + HTTP mocks (msw) | Retry/timeout/error branches |
| `X402Paywall.node.ts` | Smoke test против live facilitator | Полный n8n-mock — трата времени |
| Live 50-tx burst | Integration | Evidence для submission |

### 6.2 Unit tests (перечень)

- Builder: USDC 6 decimals, Arc eip155 encoding, base64 encoding, throws on negative price
- Facilitator client: parses verify/settle response, retries 502 exponentially, throws X402TimeoutError на 10s

**Tool:** vitest (быстрее jest, TS-ready).

### 6.3 Integration smoke test

Mock facilitator (Express на :5001) + n8n с нашей нодой + curl без sig → 402 → curl с sig → 200.

### 6.4 `scripts/burst-50.ts`

Главный артефакт после самой ноды. Использует `@x402/core` + viem. Делает N запросов к target URL, каждый — полный цикл (402 → sign → retry → 200), логирует durationMs и txHash, записывает `burst-50-evidence.json`. Параметры через env: `TARGET`, `COUNT`, `PRIVATE_KEY`.

### 6.5 Manual QA чеклист (`docs/MANUAL_QA.md`)

- Clean install через `npm install n8n-nodes-x402-paywall`
- Иконка/название в palette
- Credentials form
- Activate → curl 402
- Burst end-to-end
- 50 tx в Arc Explorer
- 50 tx в Circle Console
- Workflow executions в n8n history
- README complete (включая MIT license, Circle products)

---

## 7. Submission materials

### 7.1 Presentation deck (12 слайдов, 16:9)

1. **Title** — `n8n x402 Paywall` / «One node. Paid workflows. Zero gas.»
2. **The problem** — Stripe $0.30 min / n8n subscription / traditional gas → sub-cent невозможно
3. **The insight** — x402 + USDC on Arc = sub-cent, sub-second, zero gas
4. **What we built** — одна community-нода, MIT, open source
5. **How it works** — упрощённая sequence-диаграмма
6. **Live in action** — 4 скриншота (credentials, properties, curl 402, curl 200)
7. **50 real transactions on Arc** — Arc Explorer + Circle Console + evidence JSON
8. **Margin story** — таблица Stripe vs ACH vs wire vs Arc+x402 для $0.005
9. **Real use cases** — Telegram bots, LLM APIs, agent-to-agent
10. **2-agent autonomous loop** — наше демо = этот loop
11. **Circle stack used** — track + products + why
12. **Close** — ссылки, QR, signature

**Deliverable:** `assets/presentation.pdf` + исходник `.key`/`.gslides`.

### 7.2 Submission form fields (lablab.ai)

- **Project name:** `n8n X402 Paywall — One Node, Paid Workflows`
- **Challenge track:** Best Autonomous Commerce Application
- **Short description:** подготовленный абзац (см. §7.4)
- **Technology:** n8n (TS), x402, Circle Nanopayments, Arc testnet, USDC
- **Circle products used:** Arc, USDC, Nanopayments (via x402 facilitator)
- **Circle Product Feedback:** полный essay (см. §7.3)
- **GitHub repo:** `github.com/NikolayMicheev/n8n-nodes-x402-paywall`
- **Demo URL:** presentation PDF link + optional live endpoint
- **Team:** Николай Михеев (+ Vadim если добавится)

### 7.3 Circle Product Feedback — draft (essay на $500)

Полный draft хранится в `docs/CIRCLE_FEEDBACK.md`, структура:

- **Arc (Testnet)** — why we chose it over Base Sepolia/Arbitrum (stablecoin-native fees, sub-second finality, EVM compat)
- **USDC** — 6-decimal precision, pricing sweet spot
- **Nanopayments via x402 facilitator** — не использовали SDK напрямую, использовали facilitator pattern под капотом которого Nanopayments
- **Worked well** — x402 docs, faucet, Circle Console transaction visibility
- **DX improvements** — Gateway-compatible facilitator URL quickstart для Arc Testnet, TypeScript types на verify/settle, «Arc testnet with USDC preloaded» cloud sandbox
- **Why it matters** — 800K n8n community, Circle-stack-as-default-primitive для low-code automation

Финализируется с реальными цифрами из burst-50 в пятницу/субботу.

### 7.4 README.md структура

```
# n8n X402 Paywall
[GIF: canvas + curl 402 + burst]

One-paragraph pitch

## ✨ What this is
## 🚀 Quick install
## 🧪 Live demo (curl команда + ожидаемый результат)
## 📊 Proof: 50 real transactions on Arc
## 🧩 How it works
## 🛠 Configuration (таблица из §3)
## 🏗 Architecture (ссылка на ARCHITECTURE.md)
## 🎯 Hackathon submission
Track: Best Autonomous Commerce Application
## 📜 License — MIT
```

### 7.5 Live public endpoint (опционально)

На публичном сервере пользователя: n8n + активный workflow с Paywall trigger → Set node (мок премиум-контента). URL — в README и submission form. Цена — $0.001 чтобы не потратить testnet кошелёк.

---

## 8. План на 2 дня

### 8.1 Приоритеты (must vs nice)

**MUST:** нода билдится, 402 корректный, facilitator verify+settle работают, workflow триггерится, `burst-50.ts` даёт 50 реальных tx, evidence + Arc Explorer + Circle Console скриншоты, presentation PDF 12 слайдов, README+MIT, GitHub public, submission form + Circle Feedback заполнены.

**NICE:** unit-тесты, GIF в README, live public endpoint, npm publish, advanced UI fields.

### 8.2 Почасовой график

**Четверг 23.04 (18:00–23:00, 5h) — Setup + первый 402**
- 18:00–18:30: User: Circle Dev Console reg, GitHub repo create, Arc wallet PK export, USDC faucet
- 18:30–20:00: Scaffold (n8n-nodes-starter → rename, package.json с n8n field + MIT, tsconfig, eslint)
- 20:00–21:30: paymentRequirements.ts + credentials + скелет node, всегда 402
- 21:30–22:30: Local n8n install + smoke → curl получает 402 с валидным base64 payload
- 22:30–23:00: Commit, push

**Пятница 24.04 (09:00–20:00, 11h) — Core + burst**
- 09:00–11:00: facilitatorClient.ts (verify/settle + timeout/retry)
- 11:00–13:00: Интеграция facilitator в webhook handler + все error branches
- 14:00–16:00: burst-50.ts
- 16:00–17:00: Micro-burst 3–5 tx, debug
- 17:00–18:00: Debug Arc chain ID / USDC address / facilitator Arc support
- 18:00–19:00: Полный 50-tx burst → evidence JSON
- 19:00–20:00: Скриншоты Arc Explorer, Circle Console, terminal → `assets/`

**Суббота 25.04 (09:00–20:00, 10h) — Polish + submit**
- 09:00–10:00: Unit tests (минимальный set)
- 10:00–12:00: README с реальными скриншотами
- 12:00–13:30: Presentation slides 1-6
- 14:00–15:30: Presentation slides 7-12, polish
- 15:30–16:30: Live public endpoint на твоём сервере + smoke
- 16:30–17:30: Circle Product Feedback essay + submission form drafts
- 17:30–18:30: Финальный 50-tx burst (evidence fresh)
- 18:30–19:30: Submit на lablab.ai + final commit + git tag v0.1.0
- 19:30–20:00: Buffer

### 8.3 Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Circle Dev Console KYC delay | 🟡 | Регистрация в первый же час |
| x402 facilitator не поддерживает Arc testnet | 🟡 | Fallback: Base Sepolia; Arc — как roadmap в Product Feedback |
| n8n community node не стартует локально | 🟢 | starter repo проверенный, debug по env NODES_DIR |
| Burst падает (ratelimit / nonce) | 🟡 | `sleep 1s` между запросами, manual nonce sync |
| Live public endpoint не успеваем | 🟢 | Cut — оставляем curl-тест как proof |
| User не успевает Circle Dev Console | 🟡 | Console screenshots — «to be added post-submission», evidence через Arc Explorer |

### 8.4 Check-gates (daily stop/go)

- **Чт 23:00**: `curl -v <url>` возвращает 402 с валидным PAYMENT-REQUIRED base64 → if not, debug до сна
- **Пт 19:00**: 50 успешных tx, evidence file готов → if < 50, chill polish, fix burst
- **Сб 17:30**: Final burst OK → if not, использовать четверговый, в submission писать N successful честно

### 8.5 Параллельное распределение

**User делает сам:** Circle Dev Console reg, GitHub repo create, Arc wallet PK export в `.env`, опциональный polish презентации, опциональная запись screencast.

**Claude делает:** весь код, билды, тесты, burst runs (под private key из env), драфты README/presentation/Circle Feedback, submission form заполнение текстом.

---

## 9. Open Questions / TODO перед стартом Day 0

- [ ] Установлен ли `gh` CLI? (если нет — user создаёт пустой репо в веб-UI и даёт URL)
- [ ] Node.js версия (нужно ≥20). User не уверен — проверим в первые минуты Day 0
- [ ] Arc testnet RPC URL, chain ID, USDC contract address — уточнить в первый час по `arc_network_arc_references_contract-addresses`
- [ ] Подтверждено ли, что x402 facilitator `https://x402.org/facilitator` поддерживает Arc testnet — если нет, Base Sepolia как fallback (см. риск в §8.3)
- [ ] Finalize npm package name — `n8n-nodes-x402-paywall` reserved?

---

## 10. Success criteria (как поймём что сработало)

**Технически (MUST):**
- `npm install n8n-nodes-x402-paywall` (или local tarball) в чистый n8n → нода появляется в palette
- Workflow с нашей нодой + Set node активируется
- `curl <webhook>` → 402 с валидным base64 PAYMENT-REQUIRED
- `burst-50.ts` проходит 50/50 tx в Arc testnet без вмешательства
- Все 50 tx видны в Arc Explorer + Circle Console

**Submission (MUST):**
- Репо публичный на GitHub, MIT license, README полный
- Presentation PDF в `assets/`, 12 слайдов
- Submission form на lablab.ai заполнена до 25.04 deadline
- Circle Product Feedback — развёрнутый essay с конкретикой

**Стратегически (цель):**
- Один из призов: $3K first / $500 Circle Feedback / $1K-$2K секундарные
- Попадание в top-10 submissions по narrative clarity и technical execution
- (Post-hackathon) публикация в n8n community marketplace — как roadmap
