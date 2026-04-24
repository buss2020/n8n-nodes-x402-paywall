# x402 Arc Facilitator (self-hosted)

Tiny Express service that provides the x402 facilitator wire contract
(`POST /verify`, `POST /settle`, `GET /supported`) for **Arc testnet**
(`eip155:5042002`). We run this because `x402.org/facilitator` does not
support Arc as of 2026-04-24 (see
`../docs/research/2026-04-24-x402-arc-findings.md`).

Under the hood it is:

- [`x402Facilitator`](https://www.npmjs.com/package/@x402/core) from `@x402/core/facilitator`
- [`ExactEvmScheme`](https://www.npmjs.com/package/@x402/evm) from `@x402/evm/exact/facilitator`
- a [`viem`](https://viem.sh) wallet client extended with `publicActions`,
  pointed at `https://rpc.testnet.arc.network`.

No auth, no rate limiting. Intended to run behind Caddy + TLS on the VPS.

## Environment

| Var | Required | Notes |
|-----|----------|-------|
| `FACILITATOR_PRIVATE_KEY` | yes | 0x-prefixed hex. Arc testnet USDC faucet: <https://faucet.circle.com/> |
| `PORT` | no | Default `3001`. |

Copy `.env.example` → `.env` and fill the key:

```sh
cp .env.example .env
# edit .env, set FACILITATOR_PRIVATE_KEY=0x...
```

## Local dev

```sh
npm install
npm start     # tsx src/index.ts
```

Smoke test:

```sh
curl -s http://localhost:3001/supported | jq
```

Expected shape:

```json
{
  "kinds": [
    {"x402Version":2, "scheme":"exact", "network":"eip155:5042002"}
  ],
  "extensions": [],
  "signers": {"eip155:*": ["0x...facilitator address..."]}
}
```

Health probe (not part of the x402 contract — used by the load balancer):

```sh
curl -s http://localhost:3001/healthz
```

## Deploy to VPS (Docker)

The hackathon VPS is `2.26.21.34` (`xorek.cloud`, Ubuntu 24.04),
SSH key `~/.ssh/claude_vadim_tg`. n8n already runs on it via docker-compose
at `~/claude-vadim-tg/`.

```sh
# from this directory, on your laptop:
rsync -az --delete \
  --exclude node_modules --exclude .env \
  ./ root@2.26.21.34:/root/x402-facilitator/

ssh -i ~/.ssh/claude_vadim_tg root@2.26.21.34 << 'REMOTE'
  cd /root/x402-facilitator
  # one-time: put the funded key into .env
  # echo "FACILITATOR_PRIVATE_KEY=0x..." > .env
  docker build -t x402-facilitator:latest .
  docker rm -f x402-facilitator 2>/dev/null || true
  docker run -d --restart unless-stopped --name x402-facilitator \
    --env-file .env -p 127.0.0.1:3001:3001 \
    x402-facilitator:latest
REMOTE
```

Then reverse-proxy via the existing Caddy on the VPS, e.g.:

```caddy
facilitator.xorek.cloud {
  reverse_proxy 127.0.0.1:3001
}
```

Verify from your laptop:

```sh
curl -s https://facilitator.xorek.cloud/supported | jq
```

## Wire contract (cheat sheet)

Request bodies are JSON. All fields follow `@x402/core@2.10.0` types —
see `docs/research/2026-04-24-x402-arc-findings.md` §4 for canonical shapes.

- `POST /verify`  body `{ x402Version, paymentPayload, paymentRequirements }` → `VerifyResponse`
- `POST /settle`  body `{ x402Version, paymentPayload, paymentRequirements }` → `SettleResponse`
- `GET  /supported` → `SupportedResponse`

Failure fields are **`invalidReason` / `invalidMessage`** (verify) and
**`errorReason` / `errorMessage`** (settle) — NOT `reason`/`code`.

## Logs

Every verify/settle call logs one line:

```
[verify] isValid=true payer=0xabc... amount=5000 duration=187ms
[settle] success=true tx=0x... payer=0xabc... amount=5000 duration=942ms
```

## Troubleshooting

- **`/supported` returns empty `kinds`** — scheme was not registered;
  check the process started with `FACILITATOR_PRIVATE_KEY` set.
- **`500` on `/verify`** — usually an RPC error (rate limit, chain
  unreachable). Curl `curl https://rpc.testnet.arc.network` to confirm.
- **`errorReason: "insufficient_funds"` on settle** — facilitator wallet
  needs native USDC for gas on Arc. Fund via Circle faucet and retry.
