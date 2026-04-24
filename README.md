# n8n-nodes-x402-paywall

**Turn any n8n workflow into a pay-per-call USDC endpoint.**

A production-quality n8n community node that drops an [x402](https://x402.org) paywall in front of any workflow. Clients get a `402 Payment Required`, sign an EIP-3009 USDC authorization, and on settlement the node triggers the workflow and returns its result. Settlement is onchain on **Arc testnet** via a self-hosted x402 facilitator. Built for the *Agentic Economy on Arc — Nano-Payments* hackathon (LabLab x Circle x Arc, April 2026).

## What this is

- A single n8n trigger node (`X402 Paywall`) that owns the webhook, issues 402s, verifies and settles via an x402 facilitator, then fans out to your workflow with the payment metadata attached.
- A companion **self-hosted x402 facilitator** for Arc testnet (Express + `@x402/core` + `@x402/evm`), because the public `x402.org/facilitator` does not yet support Arc.
- A burst client that signs and submits 50+ real paid requests to prove the per-action economics.

## Live demo

The node is deployed behind Caddy TLS on our VPS inside a real n8n 2.17.6 instance. The self-signed cert means clients need `-k`.

```bash
# 1. Unpaid request — returns 402 with base64-encoded PAYMENT-REQUIRED header + JSON body
curl -k -i https://2.26.21.34/webhook/x402-demo

# 2. Signed request — X402 client signs EIP-3009 TransferWithAuthorization and retries
pnpm burst -- --count 1 --url https://2.26.21.34/webhook/x402-demo
```

First paid settlement onchain: [`0xc67c4fe4baac112e3ea03b4166539e08d1fa8911d7ba1ea4d4257d850adb168a`](https://testnet.arcscan.app/tx/0xc67c4fe4baac112e3ea03b4166539e08d1fa8911d7ba1ea4d4257d850adb168a).

## Install

```bash
# From your n8n custom-nodes directory (e.g. ~/.n8n/custom/)
npm install n8n-nodes-x402-paywall
# Restart n8n. The "X402 Paywall" trigger will appear in the node picker.
```

For local dev against this repo:

```bash
git clone https://github.com/buss2020/n8n-nodes-x402-paywall.git
cd n8n-nodes-x402-paywall
pnpm install
pnpm build
# Then link the built package into your n8n custom dir.
```

## How it works

```
  +----------+       GET /webhook/x402-demo       +------------------+
  |  Client  | ---------------------------------> |   X402 Paywall   |
  |  (agent) |                                    |   (n8n trigger)  |
  +----------+ <------- 402 + PAYMENT-REQUIRED -- +------------------+
       |                                                  |
       | sign EIP-3009 TransferWithAuthorization          |
       | (USDC on Arc, x402 "exact" scheme)               |
       v                                                  |
  +----------+  GET + PAYMENT-SIGNATURE (base64)  +------------------+
  |  Client  | ---------------------------------> |   X402 Paywall   |
  +----------+                                    +------------------+
                                                          |
                                                  POST /verify
                                                          v
                                                 +------------------+
                                                 | x402 Facilitator |
                                                 | (self-hosted,    |
                                                 |  Arc testnet)    |
                                                 +------------------+
                                                          |
                                                  POST /settle
                                                          v
                                                 +------------------+
                                                 |   Arc testnet    |
                                                 |  USDC contract   |
                                                 | 0x3600...0000    |
                                                 +------------------+
                                                          |
                                          tx hash + PAYMENT-RESPONSE
                                                          v
                                                 downstream n8n nodes
                                                 (payment metadata in $json.payment)
```

The node issues the 402, decodes the signed payload, forwards to the facilitator for verify + settle, and only then fires the workflow. The settlement tx hash, payer address, amount, and network CAIP-2 id are injected into the workflow input so downstream nodes can log them, gate on amount, or route on payer.

## Configuration

Fields exposed by the node:

| Field                  | Type     | Default             | Notes                                                              |
|------------------------|----------|---------------------|--------------------------------------------------------------------|
| HTTP Method            | enum     | `GET`               | `GET`, `POST`, `PUT`, `DELETE`, `PATCH`                            |
| Path                   | string   | *(auto)*            | URL suffix for the webhook                                         |
| Price (USD)            | number   | `0.005`             | Per-call price in dollars, settled as USDC. Hackathon cap: `<= 0.01` |
| Network                | enum     | `arcTestnet`        | Currently `arcTestnet` (CAIP-2 `eip155:5042002`)                   |
| Resource Description   | string   | `Paid API endpoint` | Shown to the client in the 402 body                                |
| MIME Type              | string   | `application/json`  | Content-Type of the paid response                                  |
| Max Timeout (seconds)  | number   | `300`               | Window the client has to sign and retry                            |
| Response Mode          | enum     | `lastNode`          | `lastNode` or `onReceived`                                         |
| Advanced - Skip Settlement     | bool   | `false`    | Verify-only mode for dev/tests                                     |
| Advanced - Facilitator Override | string | *(from creds)* | Per-node override of the facilitator URL                        |

Credentials (`X402 Paywall API`):

| Credential            | Required | Description                                                               |
|-----------------------|----------|---------------------------------------------------------------------------|
| Pay-To Address        | yes      | EVM address that receives USDC (the workflow owner)                       |
| Facilitator URL       | yes      | Our self-hosted facilitator, e.g. `http://x402-facilitator:3001`          |
| Facilitator API Key   | no       | Reserved for future auth on hosted facilitators                           |

## Proof: 50+ transactions on Arc testnet

Evidence artifact: [`assets/burst-50-evidence.json`](./assets/burst-50-evidence.json) — one row per settled request with payer, amount, and tx hash. Each hash opens on Arcscan:

```
https://testnet.arcscan.app/tx/<hash>
```

The burst client lives in [`scripts/burst.ts`](./scripts/burst.ts) and speaks vanilla x402 v2, so any x402-compliant client works against the live endpoint, not just ours.

## Architecture

Full design spec and rationale: [`docs/superpowers/specs/2026-04-23-n8n-x402-paywall-design.md`](./docs/superpowers/specs/2026-04-23-n8n-x402-paywall-design.md).

Technical findings that shaped the implementation (x402 v2 package layout, Arc parameters, why we self-host): [`docs/research/2026-04-24-x402-arc-findings.md`](./docs/research/2026-04-24-x402-arc-findings.md).

## Hackathon submission

- **Event:** *Agentic Economy on Arc — Nano-Payments* (LabLab x Circle x Arc, April 2026)
- **Track:** Best Autonomous Commerce Application
- **Team:** Nikolay Micheev + Vadim Buss
- **Per-action price:** 0.001 USDC (one-tenth of the 0.01 USDC cap)
- **Onchain evidence:** 50+ settled transactions on Arc testnet, Circle Developer Console dashboard, Arcscan verification
- **Circle Product Feedback:** see [`docs/CIRCLE_FEEDBACK.md`](./docs/CIRCLE_FEEDBACK.md)

### Originality

This is original work built for this hackathon. It is not a fork of any prior x402 submission, n8n paywall node, or "agentic commerce" reference app. The only external components are the upstream `@x402/core` and `@x402/evm` packages from the x402 Foundation (Apache-2.0), consumed as npm dependencies.

## License

[MIT](./LICENSE) - Copyright (c) 2026 Nikolay Micheev.
