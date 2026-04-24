# Hackathon Submission Audit — "Agentic Economy on Arc"

**Audit date:** 2026-04-24
**Auditor:** Claude (research agent)
**Hackathon URL (primary):** https://lablab.ai/ai-hackathons/nano-payments-arc
**Official on-site event page:** https://community.arc.network/public/events/agentic-economy-on-arc-hackathon-xoayqenc6j
**Lablab rules book:** https://lablab.ai/hackathon-rules
**Lablab submission guide:** https://lablab.ai/blog/hackathon-guidelines

> **Data-quality caveat.** `lablab.ai/ai-hackathons/nano-payments-arc` returns **403** to every WebFetch attempt (Cloudflare bot block). All findings below triangulate from: (a) WebSearch cached excerpts of that URL, (b) the Arc-hosted community event page (fetched successfully), (c) prior-iteration hackathon `agentic-commerce-on-arc` (Jan 2026), and (d) the lablab platform-wide rulebook. Any bullet marked "UNVERIFIED" or "ASSUMPTION" must be confirmed manually by a human before submission. Recommended: open the page in a real browser (user already logged in) and fill `docs/research/submission-form-live-screenshot.md` with a walk-through.

---

## 1. Exact deadline

| Field | Value | Source |
|---|---|---|
| Online submission cutoff | **April 25, 2026** | lablab cached + Arc community page |
| Time | **23:59** | Arc community page ("11:59 PM") |
| Timezone | **PDT (America/Los_Angeles)** | Arc community page explicitly states "11:59 PM PDT" |

**In UTC:** 2026-04-26 06:59 UTC.
**User-local (Europe/...):** add 9–10h to PDT depending on DST. In practice: **early morning Sunday 2026-04-26**.

**DISCREPANCY** vs project CLAUDE.md: CLAUDE.md says "25 апреля 2026" but omits time+TZ. Pin **23:59 PDT = 06:59 UTC Apr 26**. Our internal "submit by Saturday evening" plan has ~6–10h buffer; tighten the check-gate accordingly.

---

## 2. Submission form fields (reconstructed)

These are the **platform-standard** lablab.ai submission fields. Specific hackathons may add extra fields (Circle Product Feedback is one such addition). Triangulated from lablab platform guide + prior-iteration submitted projects (e.g. `/agentic-commerce-on-arc/status-402/arc-merchant-autonomous-x402-micropayments`):

**Required:**
- **Submission Title** — ≤ **50 characters**
- **Short Description / Summary** — ≤ **255 characters**
- **Cover Image** — recommended 16:9 ratio
- **Full Description** (README-style long form; Markdown)
- **Technologies / Tags** — picked from lablab.ai/tech catalog (must include "Arc", "USDC", "Nanopayments" etc. — check which are in the catalog)
- **Public GitHub repository URL** — MUST be public; multi-repo setups should be linked from README
- **Demo application URL** — live deployment (our remote n8n endpoint on VPS `xorek.cloud`)
- **Video presentation link** — YouTube/Vimeo or direct link, **< 300 MB if direct upload, ≤ 5 minutes duration**
- **Pitch deck** — slides as link (Google Slides / PDF)
- **Challenge track selection** — which of the 5 tracks (must pick one per Circle rules)

**Hackathon-specific required fields (Circle):**
- **Circle Product Feedback** — long-form answer describing: which Circle products used (Arc, USDC, Wallets, Gateway, CCTP/Bridge, Nanopayments), why each was chosen, feedback/pain-points. **This is the $500 USDC bonus field.**
- **Per-action pricing evidence** — must show ≤ $0.01 per action (ours: 0.001 USDC = $0.001)
- **Transaction count evidence** — 50+ on-chain tx in demo
- **Margin story** — why model fails with traditional gas

**Optional / auto-filled:**
- Team members (from team dashboard)
- Cover image
- Additional links

**UNVERIFIED (pending live form walk):**
- Hard character limits on each long-form field
- Whether video must be YouTube specifically or any public URL
- Whether pitch deck is mandatory or optional

**Action:** user should open the submission form once in browser and screenshot every field — add to this doc as section 2.1.

---

## 3. Video format constraints

| Constraint | Value | Source |
|---|---|---|
| Max file size (direct upload) | **300 MB** | lablab platform guide |
| Max duration | **5 minutes** | lablab platform guide |
| Format | **Link submission** (YouTube / Vimeo / direct .mp4) | guide says "provide a link" |
| Min duration | Not specified (assume ≥ 60s for useful demo) | — |
| Resolution | Not specified (assume 1080p standard) | — |

**Hackathon-specific mandatory video content** (from Circle requirements):
- Must show **a transaction executed through Circle Developer Console**
- Must show **verification of that transaction on Arc Block Explorer**
- Must show **end-to-end USDC flow** using Circle infra + Arc settlement

**DISCREPANCY** vs CLAUDE.md Task 13.5: our plan has "Circle-managed tx screencast" as Task 13.5 separate from the main demo (Task 15). Confirm these both fit inside the **5-minute** cap. Recommend: one integrated video, not two, to stay under the limit. If split, main demo (≤4 min) + Circle Console beat (≤1 min) as one cut.

---

## 4. Evaluation criteria

**No explicit published rubric or weightings** found in public-facing sources. Signals from requirement lists and prior-iteration winners:

Weighted (inferred — NOT OFFICIAL):
1. **Hard-requirement compliance** (binary gate): ≤$0.01 pricing, 50+ tx, Circle Console evidence, Arc Explorer verification, MIT license. Miss any = likely disqualified.
2. **Technical execution** — does it work end-to-end; code quality
3. **Originality** — MIT + original work (explicit rule)
4. **Use-case fit / track alignment** — must align to one track
5. **Agentic depth** — 2+ agent autonomous loop signalled in current iteration as a differentiator
6. **Circle product integration breadth** — which Circle products used + quality of feedback
7. **Presentation** — pitch deck + video clarity

**UNVERIFIED:** no numeric weighting published. Judges named as "Arc and Circle representatives" but individual judges / bios not confirmed for this iteration.

---

## 5. Track definitions (VERIFIED against prior iteration + current)

| Track | Definition | Our fit |
|---|---|---|
| **Best Gateway-Based Micropayments Integration** | "Create an application that uses Gateway-based micropayments (x402 or otherwise) to enable usage-based payment flows" | **Strong fit** — we use x402 protocol. Arguably competitive with our primary track. |
| **Best Trustless AI Agent** | "Build a trust-minimized autonomous agent with identity, policies, guardrails, and onchain treasury logic" | Weak fit — we don't have treasury/policy logic, just paywall |
| **Best Autonomous Commerce Application** | "Develop a compelling buyer or seller application demonstrating autonomous commerce powered by onchain payments" | **Primary fit** — seller = n8n paywall node, buyer = n8n client workflow |
| **Best Dev Tools** | "Create SDKs, libraries, or infrastructure that accelerate building autonomous commerce experiences with Gateway and Arc" | **Also strong fit** — an n8n community node IS a dev-tool / library for workflow builders |
| **Best Product Design** | "Best UI/UX integration for onchain agentic payments" | Poor fit — n8n node is config-heavy, not end-user UI |

**DISCREPANCY** vs CLAUDE.md: our project context lists **3 tracks**; **there are actually 5**. Two we missed: Dev Tools and Product Design. Dev Tools is arguably the single best fit — an n8n community node literally is a dev tool.

**Recommendation:** pick **Best Autonomous Commerce Application** as primary (per CLAUDE.md, aligns with 2-agent demo narrative). If form allows tagging multiple, secondary = **Best Dev Tools** and **Best Gateway-Based Micropayments Integration**. If only one allowed, Autonomous Commerce is the safer bet because judges see a working buyer+seller loop.

**Edge-case risk:** a single track might have stronger competitors. Dev Tools might be less crowded (fewer teams will ship a packaged SDK). Worth checking # submissions per track before final pick if form allows a late change.

---

## 6. Team constraints

- **Solo allowed:** Yes (confirmed on Arc community page — "compete solo or in teams")
- **Max team size:** **NOT PUBLISHED**. Platform norm is 5–6. We are 2 (Nikolai + Vadim), so any reasonable cap is safe.
- **Team registration:** via lablab team dashboard. Both `NikolayMicheev` and `buss2020` must be on the lablab team.

**Action:** user should verify both accounts are added to the team on lablab.ai before submission.

---

## 7. License requirement

- **MIT** (explicit default across all lablab.ai hackathons; "unless specified otherwise")
- **Must be open source**
- **Must be original work** (no borrowing prior codebases)

**No alternatives mentioned** (Apache 2.0, AGPL, etc.) for this hackathon. Assume strict MIT.

**Action items:**
1. Confirm `LICENSE` file at repo root is MIT (SPDX: `MIT`)
2. Confirm `package.json` has `"license": "MIT"`
3. Any vendored deps (if any) — check their licenses are MIT-compatible (Apache-2.0 is fine, AGPL/GPL is NOT)
4. n8n itself is "Sustainable Use License" — we don't fork n8n, we just build a community node against its public SDK, so we're fine.

---

## 8. Circle Product Feedback — scoring

**Rubric (Circle's own words):** "The most detailed and helpful responses will be eligible for the Product Feedback Incentive ($500 USDC)."

**No numeric rubric published.** Inferred from "most detailed and helpful":
- **Detail:** specific version numbers, specific API calls that worked/failed, reproducible scenarios
- **Helpful:** actionable feedback — what would unblock other devs, specific feature requests with rationale
- **Breadth:** covering multiple Circle products if used (Nanopayments + Wallets + Gateway + Arc RPC)
- **Evidence-grounded:** link to your code, screenshots of console behavior, concrete tx hashes

**Strategy:** treat the Circle Product Feedback field as a mini bug-report-and-feature-request doc. Include:
- Which products we touched
- What worked out-of-the-box
- What was underdocumented or confusing (honest, specific)
- Concrete feature requests with rationale (e.g. "webhook for successful nanopayment settlement")
- DX pain points encountered during 2-day sprint
- If possible, 1–2 suggestions per product category

Target: **500–1500 words**, not a one-liner. This is a $500 USDC bonus for ~1 hour of writing.

---

## 9. On-site component (San Francisco 25–26 April)

| Fact | Value |
|---|---|
| Location | San Francisco, CA |
| Apr 25 | On-site build day — teams refine projects in person |
| Apr 26 | On-site demos + awards announcement |
| Hybrid? | **Yes** — online phase (Apr 20–25) is the primary competition; on-site is for the "most impactful teams" who get invited after submission |
| Travel covered? | **No** ("Travel and accommodation will not be covered") |
| Online-only eligibility? | **Yes (inferred)** — the Arc event page describes it as "hybrid" and explicitly says you submit online by Apr 25; on-site is for selected teams. Per the prior (Jan 2026) iteration: "The most impactful teams were invited to participate in person in San Francisco." |
| Penalty for not attending on-site? | **No explicit penalty found**, but likely a **tilt** — judges will favor teams who can present live. Pitch/video must carry our case. |

**DISCREPANCY** vs CLAUDE.md: CLAUDE.md calls on-site an "onsite event" without clarifying eligibility. **We are online-only** (user is in Europe). This should be factored into video production quality — our video IS our live pitch.

**UNVERIFIED:** whether online-only teams are eligible for 1st place or only some consolation prize. Worth a direct question to lablab discord / hackathon hosts before submit.

---

## 10. Prize pool — DISCREPANCY FOUND

| Source | Pool | 1st | 2nd | 3rd |
|---|---|---|---|---|
| **CLAUDE.md (our assumption)** | **$20K** | $3K + 1000 Man-Hours ($1,500) | — | — |
| **Arc community page (fetched)** | **$10K** | — | — | — |
| **Lablab cached (WebSearch)** | — | — | $2K + 500 MH ($750) | $1K + 300 MH ($450) |
| **Plus** | — | +$500 USDC Circle Product Feedback bonus | | |

**Triangulated best guess:** 1st = $3K cash + 1000 MH credits (~$1,500), 2nd = $2K + 500 MH, 3rd = $1K + 300 MH. Headline "$10K" may refer to cash-only; "$20K" includes MH-credit value, or one of the two numbers is stale/outdated. **Needs human confirmation on the live page.**

**Impact:** low — we optimize for winning, not for cash-amount arbitrage. Worth correcting in CLAUDE.md after user confirms.

---

## 11. Additional requirements discovered

- **Pitch deck is required**, not just "nice-to-have". Not currently called out in CLAUDE.md as a first-class deliverable — we have "видео / презентация" but pitch deck needs its own task.
- **Cover image 16:9** — small but required; needs to be designed (or auto-generated from the README hero) before submission.
- **Team dashboard on lablab** — registration flow must complete for BOTH contributors before submit window closes.
- **Tech tags** — technology tags are picked from a fixed lablab catalog (`lablab.ai/tech`); "Arc" and "Nanopayments" tags existence is not confirmed — verify on that catalog page.

---

## GAP list — things missing from our plan that we MUST add

### Critical (plan-blocker)

1. **Timezone pin.** Update CLAUDE.md deadline to **23:59 PDT / 06:59 UTC 2026-04-26**. Our Saturday submit plan has only ~12h buffer, not "full Saturday".
2. **Pitch deck as deliverable.** Plan lists video + presentation vaguely. Add a concrete Task: "Produce 8–12-slide deck (Google Slides) covering: problem, solution, demo, tx evidence, track fit, Circle feedback summary". ≤ 2h.
3. **Circle Product Feedback long-form write-up.** $500 USDC bonus, not currently a plan task. Add: "1 hour — write 500–1500 word detailed feedback with specific Circle product pain-points discovered during build". Schedule Saturday morning.
4. **Cover image 16:9.** Add 30-min task.
5. **Track selection decision.** Plan says "Autonomous Commerce"; confirm vs **Dev Tools** before submit. Ask user explicitly.
6. **MIT license file + package.json license field.** Add verification gate in Task 14.

### High

7. **Video length discipline.** Must fit Circle Console beat + Arc Explorer beat + demo in **≤ 5 minutes**. Storyboard explicitly (not "~3min demo + ~1min extras"). One integrated cut, not two separate clips.
8. **Live-page form walk.** User should open submission form once, screenshot every field + character counts, and paste into this audit doc as section 2.1. Confirms no surprise required field (e.g. DevPost-style Q&A) on submission day.
9. **Both accounts on lablab team.** Confirm `NikolayMicheev` and `buss2020` are both members of the same lablab.ai team before Friday evening.
10. **Technology tags catalog.** Verify "Arc", "USDC", "Nanopayments", "x402", "n8n" tags exist in `lablab.ai/tech`. If missing, fall back to closest matches.

### Medium

11. **Online-only eligibility question.** DM lablab / Circle mods on Discord: "Are online-only teams eligible for 1st–3rd place, or only on-site?" Removes a risk we can't control otherwise. Low-effort, high-value.
12. **Prize breakdown verification.** Capture exact 1st–3rd place prize details from live page; correct CLAUDE.md.
13. **Judges.** Identify named judges if published; tailor pitch tone to their background.
14. **Originality claim.** Add a short "originality statement" to README asserting the node is original work (not a fork of any prior hackathon submission). Protects against disqualification on audit.

### Low (nice to have)

15. **Hashtags / social.** Some lablab hackathons want a tweet/X post tagging `@lablabai @circle`. Not confirmed for this iteration, but cheap to do.
16. **Discord check-in.** Some hackathons require at least one "hello" in the hackathon Discord channel as an attendance signal. Cheap to do.

---

## Discrepancies summary (TL;DR)

| Item | We thought | Reality | Fix |
|---|---|---|---|
| Tracks | 3 (Gateway, Trustless Agent, Autonomous Commerce) | **5** — add Dev Tools + Product Design | Consider Dev Tools as primary/secondary |
| Deadline timezone | "послезавтра" no TZ | **23:59 PDT = 06:59 UTC Apr 26** | Pin in CLAUDE.md + plan gates |
| Prize pool | $20K | **$10K** on Arc page, $20K includes MH credits | Verify on live page |
| Deliverables | Code + video + presentation + 50 tx | + **Pitch deck** (separate), + **Cover image 16:9**, + **Circle Product Feedback long-form** | Add three plan tasks |
| Video length | "~3 min demo" | **Hard cap 5 min**, ≤ 300 MB | Storyboard for ≤5 min single cut |
| Track count | 3 | 5 | Consider Dev Tools |
| On-site | Optional | **We're online-only; eligibility for 1st place unverified** | Ask mods |

---

## Sources

- [Agentic Economy on Arc — lablab.ai](https://lablab.ai/ai-hackathons/nano-payments-arc) (WebFetch 403; WebSearch cached)
- [Agentic Economy on Arc Hackathon — Arc community / Arc House](https://community.arc.network/public/events/agentic-economy-on-arc-hackathon-xoayqenc6j) (fetched successfully)
- [Agentic Commerce on Arc — lablab.ai (Jan 2026 prior iteration)](https://lablab.ai/ai-hackathons/agentic-commerce-on-arc)
- [Agentic Commerce on Arc — Luma (SF event)](https://luma.com/arc-commerce-sf)
- [Lablab.ai Hackathon Rule Book](https://lablab.ai/hackathon-rules)
- [Lablab.ai Hackathon Guidelines (submission)](https://lablab.ai/blog/hackathon-guidelines)
- [Circle Nanopayments](https://www.circle.com/nanopayments)
- [Circle Nanopayments launch blog](https://www.circle.com/blog/circle-nanopayments-launches-on-testnet-as-the-core-primitive-for-agentic-economic-activity)
- [Guest Post: The New Era of Agentic Commerce (arc community)](https://community.arc.network/public/blogs/the-new-era-of-agentic-commerce-highlights-from-the-arc-hackathon)
- [From AI Hackathon to Reality: How Builders Are Using Arc for Agentic Commerce (lablab blog)](https://lablab.ai/blog/from-hackathon-to-reality-arc-agentic-commerce)
- [Arc Merchant — prior-iteration submission example](https://lablab.ai/ai-hackathons/agentic-commerce-on-arc/status-402/arc-merchant-autonomous-x402-micropayments)
