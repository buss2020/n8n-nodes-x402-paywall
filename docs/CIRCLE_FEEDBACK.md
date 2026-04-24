# Circle Product Feedback — n8n-nodes-x402-paywall

**Submission:** *Agentic Economy on Arc — Nano-Payments* (April 2026)
**Team:** Nikolay Micheev + Vadim Buss
**Repository:** https://github.com/buss2020/n8n-nodes-x402-paywall
**Track:** Best Autonomous Commerce Application

> This document is written for Circle product engineers. It is specific on purpose - we ship one n8n community node, and everything below reflects what we hit during a real two-day build, not vendor-survey generalities. Numbers from the 50-transaction demo burst are populated from `assets/burst-50-evidence.json` (cross-referenced to commit `19dd1c9`).

---

## 1. Circle products used

| Product                        | How we used it                                                                                                         | Version / identifier                                         |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------|
| **Arc Testnet**                | Target settlement chain for every paid request. All 50+ transactions live here.                                        | Chain ID `5042002`, CAIP-2 `eip155:5042002`, RPC `https://rpc.testnet.arc.network` |
| **USDC on Arc (native)**       | Unit of account for per-call pricing. Also the gas token on Arc, which removes our need to manage a second balance.    | ERC-20 at `0x3600000000000000000000000000000000000000`, 6 decimals over the ERC-20 interface, 18 decimals at the native balance layer |
| **Circle Faucet**              | Funded the facilitator signer and the burst-client payer with testnet USDC.                                            | `https://faucet.circle.com/` (Arc Testnet option)            |
| **Circle Developer Console**   | Imported the Arc testnet USDC contract so the facilitator-signer wallet shows readable `Transfer` events; also used to screencast a judge-grade transaction for the submission video. | `console.circle.com`, smart contract import flow             |
| **Arc Block Explorer (Arcscan testnet)** | Verification target for every settled tx. The README links individual hashes via `https://testnet.arcscan.app/tx/<hash>`. | `https://testnet.arcscan.app`                                |
| **x402 protocol (v2)**         | Wire protocol between client, our node, and the facilitator. Nanopayments is described as x402-compliant in Circle's launch post, so the choice aligns with where Circle is going. | `@x402/core@2.10.0`, `@x402/evm@2.10.0` (Apache-2.0, from the x402 Foundation org) |

We did **not** use Circle's hosted Nanopayments facilitator endpoint, because no public URL exists yet - see section 3 below.

## 2. Why each, with evidence

**Arc testnet** was mandated by the brief, but also a good technical fit: sub-second perceived finality in our 50-burst (mean `4750ms`) means a paywall node that blocks on settlement before releasing the paid response does not feel like a paywall from the client side.

**USDC as both asset and gas** is what makes per-action pricing at `0.001 USDC` economically honest on Arc. On a chain where gas is native ETH, a $0.001 transfer is smaller than the gas that moves it - that is the "traditional gas fees make this impossible" sentence in our submission narrative. Here, the facilitator signer needs just one balance to keep running.

**x402 v2 over a bespoke protocol.** `@x402/core` and `@x402/evm` at `2.10.0` ship typed `PaymentPayload`, `PaymentRequirements`, and the canonical `/verify` + `/settle` wire shapes, so the n8n node and the facilitator share a type contract (see `docs/research/2026-04-24-x402-arc-findings.md` section 4). The v2 CAIP-2 network identifier (`eip155:5042002`) let us target Arc without anyone's network-name enum being updated, which was decisive on a two-day deadline.

**Circle Developer Console** was added after the first successful settlement (tx `0xc67c4fe4baac112e3ea03b4166539e08d1fa8911d7ba1ea4d4257d850adb168a`) to produce the screencast that satisfies the submission-video requirement to show a transaction through the Console plus verification on Arcscan.

## 3. What worked well

1. **`@x402/core` + `@x402/evm` are genuinely plug-and-play for Arc.** We assumed we would need to fork or patch. We did not. `ExactEvmScheme` from `@x402/evm/exact/facilitator` accepts a viem wallet client pointed at any EVM chain, and v2 being CAIP-2 keyed meant registering `eip155:5042002` worked without any upstream network-map change. Our Arc facilitator is under 200 lines (`facilitator/src/index.ts`).
2. **`faucet.circle.com` is fast.** Picking "Arc Testnet" and pasting an address drops USDC in seconds. Critical because we burned through fresh signer wallets more than once while debugging EIP-3009 nonce handling.
3. **Arc sub-second finality in practice.** Across the 50-request burst, `50` confirmed at mean settle duration `4750ms` - fast enough that we keep our paywall fully synchronous without the UX feeling broken.
4. **Circle Developer Console smart-contract import UI.** Pasting `0x3600000000000000000000000000000000000000`, labelling it `USDC (Arc Testnet)`, and getting a readable `Transfer` event feed with USDC-denominated amounts was a meaningful step up from raw explorer browsing when recording the demo.
5. **Arc docs are honest about the 6-decimal ERC-20 / 18-decimal native duality.** We nearly shipped a bug using 18 decimals in `PaymentRequirements.amount`. The Arc contract-addresses doc calls this out explicitly.

## 4. What would improve DX - specific feature requests

These are ordered by how much time each would have saved our team, with the biggest first.

### 4.1 Publish a Circle-hosted x402 facilitator URL for Arc Testnet *(biggest single ask)*

The `@x402/core` `HTTPFacilitatorClient` defaults to `https://x402.org/facilitator`, whose `GET /supported` does **not** include Arc (verified live 2026-04-24: only Base Sepolia, Solana devnet, Algorand, Aptos, Stellar testnet). Coinbase's CDP facilitator at `api.cdp.coinbase.com/v2/x402/*` also does not list Arc on testnet.

The Circle Nanopayments launch post confirms Nanopayments testnet supports Arc, and `developers.circle.com/gateway/nanopayments` exists, but neither publishes a facilitator URL, an auth scheme, or a `kinds` list that a third-party x402 client can point `FacilitatorConfig.url` at. We **had to self-host a facilitator** (`facilitator/src/index.ts`) - fine for hackathon scale, a non-starter for any real n8n user who wants to monetize a workflow.

Concrete ask: a documented endpoint (e.g. `https://nanopayments.circle.com/x402`) that lists `{x402Version: 2, scheme: "exact", network: "eip155:5042002"}` in `GET /supported`, accepts a Circle Developer Platform API key via `FacilitatorConfig.createAuthHeaders`, and implements the same `/verify` + `/settle` wire shapes as the x402 Foundation reference facilitator, so existing `@x402/core` clients work unchanged. This turns every n8n workflow, every paywalled API, and every agent-to-agent service into a one-line integration against Circle's infra.

### 4.2 Typed SDK for facilitator consumption

We rolled our own `FacilitatorClient` wrapper (`nodes/X402Paywall/facilitatorClient.ts`) around `fetch` because `@x402/core`'s `HTTPFacilitatorClient` pulls in enough runtime to be awkward to embed inside an n8n node. A small, typed, zero-extra-deps Circle SDK - `@circle/x402-client` - with `verify(payload, requirements)` and `settle(payload, requirements)` returning typed `VerifyResponse` and `SettleResponse` (with the correct `invalidReason`/`invalidMessage` / `errorReason`/`errorMessage` field names - we had to look those up in the package `.d.mts` files) would let integrators skip rolling their own fetch wrapper. Bonus: bundle the retry/timeout story.

### 4.3 "Arc testnet with USDC preloaded" browser sandbox

The single biggest cost when we onboard a new judge, a new teammate, or anyone who wants to evaluate the node is "get them a funded Arc testnet wallet". A hosted, ephemeral browser-based sandbox that spins up on demand with a funded EOA (think `wallet.circle.com` but scoped to Arc testnet with 10 USDC pre-funded) would compress that onboarding from 10 minutes of copy-paste to 30 seconds. Useful for hackathon judges, useful for demos, useful for Nanopayments docs tutorials.

### 4.4 External-wallet view in Circle Developer Console

Today, to see our burst-client payer's `Transfer` events in the Console we had to import the USDC contract into a project that the wallet does not itself belong to. A "follow this external EVM address" or "add observed address" flow - where a user pastes any Arc address and sees its USDC activity through Circle's UI - would let us demo payer-side and payee-side flows from one Console without every judge having to hop to Arcscan mid-demo.

### 4.5 Gateway-compatible facilitator URL documented in Circle docs

`circle.com/nanopayments` mentions Gateway; `developers.circle.com/gateway/nanopayments` exists; but searching "x402 facilitator" across `developers.circle.com` returns no documented endpoint URL or auth scheme. A single developer-docs page - "Using Circle Nanopayments as an x402 facilitator" - with a curl example of `GET /supported`, `POST /verify`, `POST /settle` against a real Circle endpoint would unblock a whole category of integrators (us included) who already speak x402 and just want to point the URL at Circle.

## 5. Numbers from our demo

Populated from `assets/burst-50-evidence.json` at submission time (numbers to be populated from assets/burst-50-evidence.json):

- Total burst size: `50` requests
- Successful onchain settlements: `50`
- Price per request: `0.001 USDC` (one-tenth of the hackathon `0.01` cap)
- Mean client-observed settle duration (facilitator `/settle` call): `4750ms`
- First paid settlement: tx `0xc67c4fe4baac112e3ea03b4166539e08d1fa8911d7ba1ea4d4257d850adb168a` on Arc testnet
- Chain: `eip155:5042002`
- USDC asset: `0x3600000000000000000000000000000000000000`
- Facilitator: self-hosted on the VPS co-located with the n8n instance; source in `facilitator/src/index.ts`

## 6. Why this matters for Circle

n8n is the dominant low-code workflow tool outside the Zapier ecosystem, with a community in the 800K+ range of self-hosted users and an explicit "community nodes" extension surface. Every one of those users has a workflow they would like to monetize - an LLM call, a scraping endpoint, a data-enrichment step. Today they gate with API keys and human-scale billing. A Circle-hosted x402 facilitator for Arc collapses that to a checkbox: "add paywall, set price in USDC, done".

Per-action pricing at `0.001 USDC` is a new price point that only becomes coherent when gas is USDC-denominated and sub-cent - the Arc + Nanopayments story. Our node makes that story shippable by a non-blockchain-native audience. Every DX improvement above multiplies into how many of those operators ship a paid workflow in the next year.

---

*Prepared on 2026-04-24. Happy to jump on a call to walk through any of this. Contact: nikolainicheev1@gmail.com.*
