# x402 + Arc technical findings — 2026-04-24

Research for the n8n-nodes-x402-paywall hackathon node. All facts verified against live registries, published packages, and vendor docs on 2026-04-24.

---

## TL;DR (actionable)

1. **x402 npm packages exist and are at v2.10.0** — but under the `x402-foundation` org, not `coinbase/*`. Core classes (`x402Client`, `x402ResourceServer`, `HTTPFacilitatorClient`, `ExactEvmScheme`, `paymentMiddleware`) all exist. Our spec's import paths are basically correct; only minor tweaks needed.
2. **Arc testnet: chain ID `5042002`, CAIP-2 `eip155:5042002`, RPC `https://rpc.testnet.arc.network`, USDC at `0x3600000000000000000000000000000000000000` (6 decimals), explorer `https://testnet.arcscan.app`.**
3. **x402.org/facilitator DOES NOT currently support Arc.** Only Base Sepolia, Solana devnet, Algorand, Aptos, Stellar testnet on testnet side. **→ We MUST fall back to Base Sepolia for the 50+ tx burst**, OR run our own facilitator against Arc. Base Sepolia fallback is safer for a 2-day hackathon.
4. **Circle has not (publicly) published its own hosted x402 facilitator URL** as of today. Circle Nanopayments uses the x402 protocol, but there's no "facilitator.circle.com"-style endpoint documented on developers.circle.com.
5. **Facilitator wire format** is well-defined in `@x402/core` types (`VerifyRequest`/`VerifyResponse`/`SettleRequest`/`SettleResponse`). Our spec's shape needs one rename: failure field is `invalidReason` (not `reason`), payload is `invalidMessage` (not `code`). Settle response has `errorReason`/`errorMessage`.

---

## 1. x402 npm package audit (all at v2.10.0, published ~1 week ago)

All packages: **dual CJS/ESM** (ESM `.mjs` + CJS `.js`), typed. License Apache-2.0. Maintainers are Coinbase engineers (`carsonroscoe_cb`, `erik_cb`), but the org is `x402-foundation` — see [Cloudflare's "Launching the x402 Foundation"](https://blog.cloudflare.com/x402/). Homepage: <https://github.com/x402-foundation/x402#readme>.

### 1.1 `@x402/core@2.10.0`

- npm: <https://www.npmjs.com/package/@x402/core>
- Subpath exports: `.`, `./client`, `./facilitator`, `./http`, `./server`, `./types`, `./types/v1`, `./utils`, `./schemas`
- Deps: only `zod`
- Named exports we need (verified from `dist/esm/*/index.d.mts`):
  - **`@x402/core/client`**: `x402Client`, `x402HTTPClient`, `SchemeRegistration`, `PaymentPolicy`, etc.
  - **`@x402/core/http`**: `encodePaymentSignatureHeader`, `decodePaymentSignatureHeader`, `encodePaymentRequiredHeader`, `decodePaymentRequiredHeader`, `encodePaymentResponseHeader`, `decodePaymentResponseHeader`, `HTTPFacilitatorClient`
  - **`@x402/core/server`**: `x402ResourceServer`, `x402HTTPResourceServer`, `HTTPFacilitatorClient`, `FacilitatorClient`, `FacilitatorConfig`, hook types
  - **`@x402/core/types`**: all payload/requirements/request/response types + `Network`
  - **`@x402/core/schemas`**: zod schemas + `parsePaymentPayload`, `validatePaymentPayload`, etc.
- **Default facilitator URL** baked into `HTTPFacilitatorClient`: `"https://x402.org/facilitator"` (found in `dist/esm/chunk-JFGRL3BL.mjs:646`).

### 1.2 `@x402/evm@2.10.0`

- npm: <https://www.npmjs.com/package/@x402/evm>
- Deps: `@x402/core ~2.10.0`, `viem ^2.39.3`, `zod`
- Subpath exports: `.`, `./v1`, `./exact/client`, `./exact/server`, `./exact/facilitator`, `./exact/v1/client`, `./exact/v1/facilitator`, `./upto/client`, `./upto/server`, `./upto/facilitator`
- **`ExactEvmScheme` exists** in all three variants:
  - `@x402/evm` (top-level, re-export)
  - `@x402/evm/exact/client` — client-side scheme for creating payment payloads
  - `@x402/evm/exact/server` — server-side scheme for building PaymentRequirements
  - `@x402/evm/exact/facilitator` — facilitator-side scheme (verify/settle on-chain)
- **`ExactEvmSchemeV1`** and `UptoEvmScheme` also exist.
- Helper: `registerExactEvmScheme(client, { signer })` registers wildcard `eip155:*`. Accepts any chain supported by viem — including custom chains like Arc.
- V1 legacy network map (`EVM_NETWORK_CHAIN_ID_MAP`) covers 21 chains. **Arc is not in the v1 map.** V2 uses CAIP-2 so Arc works as `eip155:5042002` without the map.
- `ClientEvmSigner` interface + `toClientEvmSigner(account)` helper wraps viem accounts — this is what we'd use client-side.

### 1.3 `@x402/express@2.10.0`

- npm: <https://www.npmjs.com/package/@x402/express>
- Deps: `@x402/core`, `@x402/extensions`, `viem`, `zod`
- Exports `paymentMiddleware(routes, server, paywallConfig?)`, `paymentMiddlewareFromConfig(routes, facilitatorClients?, schemes?, paywallConfig?)`, `paymentMiddlewareFromHTTPServer(httpServer, paywallConfig?)`, plus re-exports `x402ResourceServer`, `x402HTTPResourceServer`, `PaywallConfig`, `SETTLEMENT_OVERRIDES_HEADER`, `setSettlementOverrides`, `ExpressAdapter`.
- **Note:** `HTTPFacilitatorClient` is re-exported from `@x402/core/server` — use `@x402/core/http` or `@x402/core/server` directly for the facilitator client; `@x402/express` is the Express middleware layer only.

### 1.4 `@x402/svm@2.10.0`

- npm: <https://www.npmjs.com/package/@x402/svm>
- Deps: `@x402/core`, plus `@solana-program/*`
- Single top-level export only. Not needed for EVM/Arc.

### 1.5 `@x402/extensions@2.10.0`

- Extensions (EIP-2612 gas sponsoring, ERC-20 approval gas sponsoring, SIWE). Not strictly needed but pulled in transitively by `@x402/express`.

### 1.6 Legacy `x402@1.2.0`

- Still published. 13 deps (drags in wagmi, @solana/kit, etc.). **Do not use** — it's the v1 monolithic package. v2 is the modular `@x402/*` split.

---

## 2. Arc testnet parameters (verified)

Sources:
- <https://docs.arc.network/arc/references/contract-addresses>
- <https://docs.arc.network/arc/references/connect-to-arc>
- <https://thirdweb.com/arc-testnet>
- <https://faucet.circle.com/>

| Field | Value |
|---|---|
| Chain ID | **`5042002`** |
| CAIP-2 id | **`eip155:5042002`** |
| RPC (official) | `https://rpc.testnet.arc.network` |
| WebSocket | `wss://rpc.testnet.arc.network` |
| RPC (thirdweb) | `https://5042002.rpc.thirdweb.com` |
| USDC ERC-20 | **`0x3600000000000000000000000000000000000000`** (6 decimals) |
| Native token | USDC (native on Arc; used for gas. 18-decimal native balance, 6-decimal ERC-20 interface) |
| Block explorer | `https://testnet.arcscan.app` (explorer address page: `https://testnet.arcscan.app/address/{addr}`, tx: `https://testnet.arcscan.app/tx/{hash}`) |
| Faucet | `https://faucet.circle.com/` (select Arc Testnet) |

**Gotcha:** USDC on Arc has **two decimal surfaces**:
- Native balance (used for gas): 18 decimals
- ERC-20 interface at `0x3600…0000`: 6 decimals

For x402 `exact` scheme via EIP-3009 we interact via the ERC-20 interface → **use 6 decimals** for PaymentRequirements.amount.

---

## 3. Arc support in x402 facilitator — **NOT YET**

### 3.1 x402.org/facilitator

Live `/supported` output from <https://x402.org/facilitator/supported> (fetched 2026-04-24):

```json
{
  "kinds": [
    {"x402Version":2,"scheme":"exact","network":"eip155:84532"},
    {"x402Version":2,"scheme":"upto","network":"eip155:84532","extra":{"facilitatorAddress":"0xd407e409E34E0b9afb99EcCeb609bDbcD5e7f1bf"}},
    {"x402Version":2,"scheme":"exact","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","extra":{"feePayer":"CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"}},
    {"x402Version":2,"scheme":"exact","network":"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="},
    {"x402Version":2,"scheme":"exact","network":"aptos:2"},
    {"x402Version":2,"scheme":"exact","network":"stellar:testnet"},
    {"x402Version":1,"scheme":"exact","network":"base-sepolia"},
    {"x402Version":1,"scheme":"exact","network":"solana-devnet"}
  ],
  "extensions":["eip2612GasSponsoring","erc20ApprovalGasSponsoring"],
  "signers":{"eip155:*":["0xd407e409E34E0b9afb99EcCeb609bDbcD5e7f1bf"], ...}
}
```

**Arc (`eip155:5042002`) is NOT in this list.** Only EVM testnet currently supported is Base Sepolia (`eip155:84532`).

### 3.2 Coinbase CDP facilitator (`api.cdp.coinbase.com/v2/x402/*`)

Per <https://docs.cdp.coinbase.com/x402/network-support>:

- **Mainnet:** Base, Polygon, Arbitrum, World, Solana
- **Testnet:** Base Sepolia (`eip155:84532`), World Sepolia (`eip155:4801`), Solana Devnet

**Arc is not listed.** Requires CDP API key authentication (see <https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/x402-facilitator>).

### 3.3 Circle-hosted x402 facilitator

As of 2026-04-24, **Circle has not publicly published a dedicated x402 facilitator URL.** What Circle has:

- <https://www.circle.com/nanopayments> says Nanopayments "follow[s] the x402 standard".
- <https://developers.circle.com/gateway/nanopayments> exists but doesn't expose a facilitator endpoint URL or auth scheme.
- Circle's <https://www.circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402> uses Coinbase's facilitator in its example.

Per the [Circle Nanopayments launch post](https://www.circle.com/blog/circle-nanopayments-launches-on-testnet-as-the-core-primitive-for-agentic-economic-activity), Nanopayments testnet supports 12 chains: Arbitrum, **Arc**, Avalanche, Base, Ethereum, HyperEVM, Optimism, Polygon PoS, Sei, Sonic, Unichain, World Chain. So Arc IS a target for Circle's infra — but no publicly documented x402 endpoint URL yet.

### 3.4 Recommendation for the hackathon (2 days)

**Path A — Base Sepolia fallback (RECOMMENDED for reliability):**
- Use `facilitator.x402.org` or CDP facilitator on `eip155:84532`.
- Arc not demonstrated on-chain, but we still hit the 50+ tx hackathon bar.
- **Problem:** hackathon mandate is Arc specifically. This jeopardizes judging.

**Path B — Self-hosted facilitator on Arc (RECOMMENDED given mandate):**
- Run a local facilitator (Node/Express) that instantiates `x402Facilitator` from `@x402/core/facilitator` and registers `ExactEvmScheme` from `@x402/evm/exact/facilitator` with a viem wallet client pointing at `https://rpc.testnet.arc.network` and our facilitator private key funded with testnet USDC.
- Expose as `/verify`, `/settle`, `/supported` HTTP endpoints (few dozen lines — see `@x402/core/facilitator` class).
- Point the n8n node's `FacilitatorConfig.url` at this self-hosted facilitator.
- **This is the Arc story the judges want.** It also doubles as "autonomous commerce" credential.
- Deploy the facilitator alongside n8n on the VPS (2.26.21.34) under Caddy TLS.

**Path C — Hybrid (Path A for volume, Path B for demo video):**
- Demo video shows Path B on Arc (3–5 txs for screencast).
- Volume burst (50+ txs) on Base Sepolia via x402.org/facilitator, because it's battle-tested.
- Submission note: "Arc-native settlement via self-hosted facilitator; large-volume evidence via x402.org on Base Sepolia because Arc facilitator support is still rolling out."

**Path C is safest for the hackathon deadline.**

---

## 4. Facilitator API contract (authoritative from `@x402/core/types`)

Extracted from `@x402/core@2.10.0/dist/esm/mechanisms-Djgn2ixv.d.mts`. These are the actual types the npm-published `HTTPFacilitatorClient` sends/expects.

### 4.1 `VerifyRequest` (POST body to `/verify`)

```ts
type VerifyRequest = {
  x402Version: number;              // 2 for current
  paymentPayload: PaymentPayload;   // decoded from X-PAYMENT header
  paymentRequirements: PaymentRequirements;
};
```

### 4.2 `VerifyResponse`

```ts
type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;   // e.g. "insufficient_funds", "expired_authorization"
  invalidMessage?: string;  // human-readable detail
  payer?: string;           // address that would pay
  extensions?: Record<string, unknown>;
};
```

**Note:** field is **`invalidReason`**, NOT `reason`. Field is **`invalidMessage`**, NOT `code`. Update the spec accordingly.

### 4.3 `SettleRequest` (POST body to `/settle`)

```ts
type SettleRequest = {
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};
```

### 4.4 `SettleResponse`

```ts
type SettleResponse = {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  payer?: string;
  transaction: string;     // tx hash
  network: Network;        // CAIP-2 id
  amount?: string;         // actual amount (atomic units); used by upto scheme
  extensions?: Record<string, unknown>;
};
```

### 4.5 `SupportedResponse` (GET `/supported`)

```ts
type SupportedResponse = {
  kinds: Array<{
    x402Version: number;
    scheme: string;
    network: Network;
    extra?: Record<string, unknown>;
  }>;
  extensions: string[];
  signers: Record<string, string[]>;  // CAIP-2 prefix → facilitator addresses
};
```

### 4.6 Required headers / auth

From `FacilitatorConfig`:

```ts
interface FacilitatorConfig {
  url?: string;
  createAuthHeaders?: () => Promise<{
    verify: Record<string, string>;
    settle: Record<string, string>;
    supported: Record<string, string>;
  }>;
}
```

- x402.org/facilitator: **no auth** (public).
- Coinbase CDP facilitator: auth via `Authorization` header with CDP API key. See <https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/x402-facilitator>.
- The client itself sends `Content-Type: application/json` and the JSON body above. No `x402Version` HTTP header — version is a body field.

### 4.7 HTTP headers on the resource server (our node)

From `@x402/core/http`:

- Request: `X-PAYMENT` — base64-encoded `PaymentPayload` JSON. Decode via `decodePaymentSignatureHeader(value)`.
- 402 response header: `WWW-Authenticate` in some variants; v2 primarily returns a JSON body with `PaymentRequired` shape (plus optional `X-PAYMENT-REQUIRED` header with base64 encoding via `encodePaymentRequiredHeader`).
- Post-settle response header: `X-PAYMENT-RESPONSE` — base64-encoded `SettleResponse` via `encodePaymentResponseHeader`.

### 4.8 `PaymentPayload` v2 shape

```ts
{
  x402Version: 2,
  resource?: { url: string; description?: string; mimeType?: string },
  accepted: {
    scheme: string;       // "exact"
    network: string;      // CAIP-2 e.g. "eip155:5042002"
    amount: string;       // atomic units (string — BigInt-safe)
    asset: string;        // USDC contract address
    payTo: string;        // our receive address
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  },
  payload: Record<string, unknown>,  // scheme-specific; for "exact" EVM see §5.2
  extensions?: Record<string, unknown>;
}
```

### 4.9 `PaymentRequirements` v2 shape

```ts
{
  scheme: string;              // "exact"
  network: string;             // "eip155:5042002"
  amount: string;              // atomic units as string
  asset: string;               // "0x3600000000000000000000000000000000000000"
  payTo: string;               // receiver address
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}
```

---

## 5. Client-side signing approach

### 5.1 Primary: use `@x402/evm` + viem

`ExactEvmScheme` from `@x402/evm/exact/client` already implements EIP-712 EIP-3009 `TransferWithAuthorization` signing. Integration for the Payer side (if we ever need a client node):

```ts
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0x...");
const client = new x402Client()
  .register("eip155:5042002", new ExactEvmScheme(toClientEvmSigner(account)));
```

For the **Receiver** node (our actual deliverable) we don't sign — we receive, verify via facilitator, settle via facilitator. No private key in the n8n node itself.

### 5.2 Fallback: minimal `viem` signTypedData for EIP-3009

If for any reason we can't import `@x402/evm` (e.g. ESM/CJS friction in n8n runtime), the EIP-712 `TransferWithAuthorization` struct for USDC is:

```ts
// Domain (USDC on Arc testnet)
const domain = {
  name: "USD Coin",
  version: "2",
  chainId: 5042002,
  verifyingContract: "0x3600000000000000000000000000000000000000",
} as const;

const types = {
  TransferWithAuthorization: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
  ],
} as const;

const message = {
  from:        payerAddress,
  to:          payToAddress,
  value:       BigInt(atomicAmount),
  validAfter:  0n,
  validBefore: BigInt(Math.floor(Date.now()/1000) + 3600),
  nonce:       crypto.getRandomValues(new Uint8Array(32)), // 32-byte random
};

const signature = await walletClient.signTypedData({
  account, domain, types, primaryType: "TransferWithAuthorization", message,
});

// Pack into PaymentPayload.payload
const payload = {
  signature,
  authorization: {
    from: message.from,
    to: message.to,
    value: message.value.toString(),
    validAfter: message.validAfter.toString(),
    validBefore: message.validBefore.toString(),
    nonce: toHex(message.nonce),
  },
};
```

This matches the `ExactEIP3009Payload` type exported from `@x402/evm` (verified in §1.2 source).

**Important:** The USDC EIP-712 domain `name` and `version` MUST match what the USDC contract returns from `DOMAIN_SEPARATOR()`. For Circle's native USDC on Arc these are almost certainly `name="USD Coin"`, `version="2"` (same as Ethereum/Base USDC), but we should verify on-chain with:
```
cast call 0x3600000000000000000000000000000000000000 "DOMAIN_SEPARATOR()(bytes32)" --rpc-url https://rpc.testnet.arc.network
```
and compare to a locally-computed hash with the fields above.

---

## 6. Deltas vs. our current spec (`docs/superpowers/specs/2026-04-23-n8n-x402-paywall-design.md`)

Recommended updates before implementation:

1. **Imports:** use `@x402/core/http` for header codec, `@x402/core/server` for `x402ResourceServer` + `HTTPFacilitatorClient`, `@x402/evm/exact/server` for `ExactEvmScheme` (server variant).
2. **Failure fields:** spec must use `invalidReason`/`invalidMessage` on VerifyResponse and `errorReason`/`errorMessage` on SettleResponse (not `reason`/`code`).
3. **Network string:** use CAIP-2 `eip155:5042002` everywhere, not `arc-testnet` (v1 legacy naming).
4. **USDC asset address:** hardcode `0x3600000000000000000000000000000000000000` with 6 decimals for ERC-20 x402 flow. Document the 18/6 decimal duality as a gotcha.
5. **Facilitator plan:** pick Path C from §3.4. Add a task for "stand up self-hosted facilitator for Arc demo clip" to the plan.
6. **Default facilitator URL:** `https://x402.org/facilitator` is the v2 default baked into `HTTPFacilitatorClient`. For Arc demo we override via `FacilitatorConfig.url`.
7. **Dependency pinning:** `@x402/core@^2.10.0`, `@x402/evm@^2.10.0`, `@x402/express@^2.10.0` (if using Express). All Apache-2.0. All dual CJS/ESM so n8n (CJS) can `require()` them.

---

## Sources

- [npm @x402/core](https://www.npmjs.com/package/@x402/core)
- [npm @x402/evm](https://www.npmjs.com/package/@x402/evm)
- [npm @x402/express](https://www.npmjs.com/package/@x402/express)
- [npm @x402/svm](https://www.npmjs.com/package/@x402/svm)
- [npm @x402/extensions](https://www.npmjs.com/package/@x402/extensions)
- [x402-foundation/x402 GitHub](https://github.com/x402-foundation/x402)
- [coinbase/x402 GitHub (upstream mirror)](https://github.com/coinbase/x402)
- [Cloudflare — Launching the x402 Foundation](https://blog.cloudflare.com/x402/)
- [x402.org facilitator /supported live endpoint](https://x402.org/facilitator/supported)
- [Coinbase CDP x402 Network Support](https://docs.cdp.coinbase.com/x402/network-support)
- [Coinbase CDP x402 Facilitator API Reference](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/x402-facilitator)
- [Arc — contract addresses](https://docs.arc.network/arc/references/contract-addresses)
- [Arc — Connect to Arc](https://docs.arc.network/arc/references/connect-to-arc)
- [thirdweb — Arc testnet](https://thirdweb.com/arc-testnet)
- [Circle faucet](https://faucet.circle.com/)
- [Circle Nanopayments product page](https://www.circle.com/nanopayments)
- [Circle Nanopayments testnet launch blog](https://www.circle.com/blog/circle-nanopayments-launches-on-testnet-as-the-core-primitive-for-agentic-economic-activity)
- [Circle — Autonomous Payments with Circle Wallets, USDC, & x402](https://www.circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402)
- [x402 exact EVM scheme spec](https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md)
