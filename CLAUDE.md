# Claude-Vadim-ARC-n8n — рабочий контекст

Проект — участие в хакатоне **Agentic Economy on Arc — Nano-Payments** (LabLab × Circle × Arc).

## Дедлайн
- Онлайн-сабмит: **25 апреля 2026** (послезавтра от сегодняшней 2026-04-23)
- Реальное окно кодинга: ~2 дня
- Команда: **Николай (user) + Claude Code**. Больше никого.

## Что строим
**Одна n8n community node**, готовая к публикации (но публиковать в рамках хакатона не надо). Вся логика — внутри пакета. Локальная демонстрация в собственном n8n. Презентация + 50+ реальных on-chain транзакций на Arc как доказательство.

## Мандатные требования хакатона
1. Показать транзакции в **Circle Developer Console**
2. Показать верификацию на **Arc Block Explorer**
3. Per-action pricing **≤ $0.01**
4. **Минимум 50+** on-chain транзакций в демо
5. Объяснить в заявке, почему модель нерентабельна с традиционными gas-fees
6. Заполнить **Circle Product Feedback** в сабмит-форме (бонус $500 USDC за лучшие ответы)

## Deliverables
1. Репозиторий с кодом ноды (production-quality wrapper, готовый к публикации)
2. Локальный n8n instance с установленной нодой и demo-workflow'ами
3. Демо-видео / презентация
4. 50+ tx на Arc как evidence
5. Заполненная форма на lablab.ai

## Треки (уточнено через WebSearch 2026-04-23)
Три категории, а не три трека — победитель выбирается в каждой:
- **Best Gateway-Based Micropayments Integration** — интеграция с Circle Gateway / Nanopayments
- **Best Trustless AI Agent** — автономный агент с оплатами
- **Best Autonomous Commerce Application** ← **основной для нас** (n8n workflow как paid commerce endpoint)

Призы: **$20K** общий пул. **$3,000 cash + 1000 Man-Hour credits (~$1,500)** за первое место. $500 USDC — за лучший Circle Product Feedback. Лицензия: **MIT**, originality обязательна.

**Дополнительное требование хакатона:** «система где 2+ агента автономно триггерят и сеттлят платежи для usage-based services, access control или dynamic pricing». Это прямо ложится на наш демо: агент-A (n8n buyer workflow с x402 payer client) → агент-B (n8n seller workflow с нашей Paywall trigger). Демо уже строим как 2-agent autonomous loop.

## Открытые вопросы (блокеры)
- [ ] **Q2: создание репо** — username: `NikolayMicheev`. Надо либо поставить `gh` CLI, либо user создаст репо в веб-UI и даст URL. Предлагаемое имя: `n8n-nodes-x402-paywall`
- [ ] **Q3a: Circle Dev Console** — user пока не зарегистрировался (TODO сегодня). Нужен для submission evidence.
- [ ] **Q3b: Arc testnet детали** — RPC URL, chain ID, USDC contract address на Arc testnet. Уточним перед коддингом.
- [ ] **Q3c: Node.js / pnpm версии** — user не знает; проверим перед `npm install` (нужен Node 20+, pnpm 9+ рекомендуется для n8n)
- [x] **Q4 → Paywall Trigger** — одна нода-триггер, сама держит webhook, сама отдаёт 402, сама триггерит workflow после оплаты

## Решено
- Scope: одна нода + local demo + презентация + 50+ txs (не marketplace, не публикация)
- **Q1 → A (Receiver node)**. Workflow монетизируется: трейни вешается в начало, отдаёт `402 Payment Required`, после оплаты пропускает запрос дальше. Причины выбора: проще за 2 дня, нет работы с приватным ключом, чище margin-story.
- Стек: TypeScript, n8n community node tooling, `x402` протокол (Coinbase), `circlefin/arc-nanopayments` как референс для facilitator-interaction
- Окружение (частично, по ответам user):
  - ✅ n8n локально стоит и запускается
  - ⚠️ Node.js версия — проверить перед коддингом (нужен ≥20)
  - ❌ Circle Dev Console — user регистрирует сегодня
  - ✅ Arc testnet wallet — есть (адрес/RPC/chainId уточнить)
  - ✅ Testnet USDC — есть
  - ✅ Публичный HTTPS-сервер — есть

## Ресурсы (для ресерча на фазе дизайна)
- Circle Nanopayments docs + `circlefin/arc-nanopayments` sample repo
- x402 protocol spec (Coinbase)
- n8n community node creation docs
- `circlefin/skills` (для Claude Code)

## Workflow brainstorming (по `~/.claude/CLAUDE.md`)
Текущая фаза: **Phase 1 — Понимание** (brainstorming skill, Q&A).
Дальше: Phase 2 (writing-plans) → Phase 3 (user review spec) → Phase 4 (executing-plans).

## Лог решений
- 2026-04-23 — Открыли проект, определили scope: 1 нода + demo + презентация. Открыт Q1 (Receiver vs Payer).
- 2026-04-23 — Q1 закрыт → **A (Receiver node)**.
- 2026-04-23 — Context7 research сделан: x402 middleware API понятен, Arc testnet поддерживается Circle, n8n community node структура известна.
- 2026-04-23 — GitHub username зафиксирован: `NikolayMicheev`.
- 2026-04-23 — На столе 3 архитектурных подхода: Paywall Trigger / Middleware Node / Standalone Server. Рекомендация — Trigger. Ждём решения user.
