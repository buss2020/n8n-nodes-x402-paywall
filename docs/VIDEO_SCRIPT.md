# Demo Video Script — n8n × x402 Paywall

**Target duration:** 3:30 (hard cap 5:00, hackathon rule)
**Max file size:** 300 MB (hackathon rule)
**Export:** 1080p H.264, YouTube unlisted for final link submission

---

## Segment 1 — Intro (0:00 – 0:35)

**Visual:** Title slide → split with Stripe pricing page + n8n pricing → quick cut to n8n canvas with our node highlighted in the palette

**Voiceover (narration script):**

> "Pay-per-call APIs have always been blocked by one thing: fees.
> Stripe charges thirty cents minimum per transaction. n8n Cloud is
> subscription only. At a quarter-cent per call, neither works.
> With Circle Nanopayments on Arc, settlement is gas-free for the
> developer and finalizes in under a second. Today I'm shipping
> that capability as a one-click n8n community node."

**Cutting cues:**
- 0:00–0:05 title card (logo + tagline from pitch-deck slide 1)
- 0:05–0:15 Stripe + n8n screenshot overlay
- 0:15–0:25 arc + circle logos + "gas-free USDC on Arc"
- 0:25–0:35 n8n palette highlight

---

## Segment 2 — Circle Console + Arc Explorer (0:35 – 1:30) [MANDATORY]

**Visual:** User screencast from Task 13.5 (`assets/screencaps/circle-console-tx.mov`)

**Voiceover:**

> "First, the Circle infrastructure itself. I've provisioned a
> developer-controlled wallet via the Circle Developer Console.
> I initiate a 0.01 USDC transfer from the Console UI to our
> merchant address."
>
> (pause for tx submission in Console)
>
> "Transaction hash generated. Copy it, open Arc Block Explorer."
>
> (switch to Arc Explorer showing tx)
>
> "Confirmed onchain in under a second. Zero gas paid by us.
> This is the primitive our node wraps."

**Cutting cues:**
- 0:35–0:50 Console Dashboard
- 0:50–1:10 Wallets → Transfer → Sign → Submitted
- 1:10–1:30 Arc Explorer confirmation

---

## Segment 3 — n8n node config (1:30 – 2:10)

**Visual:** Screencast of n8n UI at https://2.26.21.34 — add X402 Paywall trigger, set credentials, activate

**Voiceover:**

> "Now in n8n: drop in the X402 Paywall trigger. Credentials set the
> merchant address. Price — five tenths of a cent. Network — Arc Testnet.
> Activate. That's it. This workflow is now a paid endpoint."

**Cutting cues:**
- 1:30–1:45 palette → drop → canvas
- 1:45–2:00 credentials + parameters panel
- 2:00–2:10 activate + copy webhook URL

---

## Segment 4 — curl 402 + burst demo (2:10 – 3:15)

**Visual:** Split screen — terminal left (curl + burst script), Arc Explorer right (block explorer auto-refreshing)

**Voiceover:**

> "Unpaid curl: 402 Payment Required, with the x402 payment
> requirements encoded in a header. Exactly what an AI agent parses."
>
> (show decoded JSON)
>
> "Now the burst client — 50 paid requests in a row. Each signs an
> EIP-3009 TransferWithAuthorization locally, posts it, our facilitator
> settles it onchain."
>
> (terminal counter climbs, explorer fills up with tx)
>
> "Fifty settled transactions. Average end-to-end four point seven
> seconds, including signing, RPC submission, and Arc confirmation.
> All onchain. All zero-gas for the merchant."

**Cutting cues:**
- 2:10–2:25 curl | head -10 → decoded JSON
- 2:25–2:35 pnpm burst command starts
- 2:35–3:00 split-screen as counter hits 25 / 50
- 3:00–3:15 summary line + Arc Explorer view of all 50 tx

---

## Segment 5 — Close (3:15 – 3:45)

**Visual:** Github repo page, npm install command, closing slide

**Voiceover:**

> "Open source, MIT, install from npm with n8n-nodes-x402-paywall.
> Submitted to Best Autonomous Commerce Application track.
> Built on Arc, USDC, and the x402 protocol.
> Team: Nikolay Micheev, Vadim Buss."

**Cutting cues:**
- 3:15–3:25 github.com/buss2020/n8n-nodes-x402-paywall scroll
- 3:25–3:35 `npm install` command + n8n install instruction
- 3:35–3:45 closing slide (pitch-deck slide 12)

---

## Editing notes

- Dark neutral music, NO vocals, NO dramatic build-ups — low-key professional
- Captions: bake in for headers + code snippets (many viewers mute in reviews)
- No zoomed-in face cam — this is a product demo
- Export: YouTube upload → unlisted; paste link in submission form

## Assembly checklist

- [ ] All source recordings in `assets/screencaps/`
- [ ] pitch-deck.pdf available for title + close slides
- [ ] Voiceover recorded (can be one take in QuickTime audio, or AI-generated; latter OK, former preferred)
- [ ] Final `assets/demo-video.mp4` < 300 MB
- [ ] YouTube uploaded, unlisted, link captured
