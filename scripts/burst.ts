/**
 * x402 paid-request burst client.
 *
 * Usage:
 *   PRIVATE_KEY=0x... TARGET=https://2.26.21.34/webhook/x402-demo \
 *   COUNT=50 EVIDENCE_FILE=assets/burst-50-evidence.json \
 *   pnpm burst
 *
 * Flow per request:
 *   1. GET TARGET — expect 402 + PaymentRequired body
 *   2. Build PaymentPayload via @x402/core/client + @x402/evm (EIP-3009)
 *   3. Retry with X-PAYMENT header → expect 200 + X-PAYMENT-RESPONSE
 *   4. Record duration + transaction hash
 *
 * Designed to produce the 50+ on-chain transactions evidence demanded
 * by the Agentic Economy on Arc hackathon. Output JSON + log file are
 * submission artefacts.
 */

import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';

// ----- Config -----
const TARGET = process.env.TARGET ?? 'https://2.26.21.34/webhook/x402-demo';
const COUNT = Number(process.env.COUNT ?? 50);
const INTER_MS = Number(process.env.INTER_REQUEST_MS ?? 500);
const EVIDENCE_FILE =
	process.env.EVIDENCE_FILE ?? `assets/burst-${COUNT}-evidence.json`;
const INSECURE_TLS = (process.env.N8N_TLS_INSECURE ?? 'true') === 'true';
const PK = process.env.PRIVATE_KEY as `0x${string}` | undefined;

if (!PK) {
	console.error('[burst] FATAL: PRIVATE_KEY env var required');
	process.exit(1);
}

// When talking to the self-signed VPS cert via HTTPS, Node rejects
// the cert unless we disable TLS verification. Testnet-only; DO NOT
// flip this for mainnet.
if (INSECURE_TLS && TARGET.startsWith('https:')) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// ----- Wire x402 client -----
const account = privateKeyToAccount(PK);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });
const httpClient = new x402HTTPClient(client);

// ----- Result accumulator -----
interface Result {
	index: number;
	success: boolean;
	httpStatus: number;
	durationMs: number;
	transaction?: string;
	payer?: string;
	amount?: string;
	network?: string;
	error?: string;
}

async function main(): Promise<void> {
	console.log(
		`[burst] target=${TARGET}  count=${COUNT}  wallet=${account.address}  insecureTLS=${INSECURE_TLS}`,
	);

	const results: Result[] = [];

	// ----- Burst loop -----
	for (let i = 0; i < COUNT; i++) {
	const idx = i + 1;
	const start = Date.now();
	let httpStatus = 0;

	try {
		// 1. initial probe — expect 402
		const probeRes = await fetch(TARGET);
		httpStatus = probeRes.status;
		if (probeRes.status !== 402) {
			const text = await probeRes.text().catch(() => '');
			throw new Error(`expected 402 on probe, got ${probeRes.status}: ${text.slice(0, 120)}`);
		}

		// 2. extract PaymentRequired (body or X-PAYMENT-REQUIRED header)
		const paymentRequired = httpClient.getPaymentRequiredResponse(
			(name) => probeRes.headers.get(name),
			await probeRes.json(),
		);

		// 3. create payment payload (signs EIP-3009 TransferWithAuthorization)
		const payload = await client.createPaymentPayload(paymentRequired);

		// 4. encode as header and retry
		const headers = httpClient.encodePaymentSignatureHeader(payload);
		const paidRes = await fetch(TARGET, { headers });
		httpStatus = paidRes.status;

		if (!paidRes.ok) {
			const body = await paidRes.text().catch(() => '');
			throw new Error(
				`paid request ${paidRes.status}: ${body.slice(0, 200)}`,
			);
		}

		// 5. settlement response
		const settle = httpClient.getPaymentSettleResponse((n) =>
			paidRes.headers.get(n),
		);

		const durationMs = Date.now() - start;
		results.push({
			index: idx,
			success: true,
			httpStatus,
			durationMs,
			transaction: settle.transaction,
			payer: settle.payer,
			amount: settle.amount,
			network: settle.network,
		});
		console.log(
			`[${idx}/${COUNT}] OK tx=${settle.transaction} duration=${durationMs}ms`,
		);
	} catch (err) {
		const durationMs = Date.now() - start;
		const msg = err instanceof Error ? err.message : String(err);
		results.push({ index: idx, success: false, httpStatus, durationMs, error: msg });
		console.log(`[${idx}/${COUNT}] FAIL ${msg.slice(0, 160)} (${durationMs}ms)`);
	}

		if (i < COUNT - 1 && INTER_MS > 0) {
			await new Promise((r) => setTimeout(r, INTER_MS));
		}
	}

	// ----- Summary -----
	const ok = results.filter((r) => r.success).length;
	const avgMs = Math.round(
		results.reduce((a, r) => a + r.durationMs, 0) / Math.max(results.length, 1),
	);
	const avgOkMs = Math.round(
		results.filter((r) => r.success).reduce((a, r) => a + r.durationMs, 0) /
			Math.max(ok, 1),
	);

	console.log('');
	console.log('=== SUMMARY ===');
	console.log(`  successful: ${ok}/${COUNT}`);
	console.log(`  failed:     ${results.length - ok}`);
	console.log(`  avg dur:    ${avgMs}ms  (success-only: ${avgOkMs}ms)`);

	// ----- Evidence -----
	await mkdir(path.dirname(EVIDENCE_FILE), { recursive: true });
	await writeFile(
		EVIDENCE_FILE,
		JSON.stringify(
			{
				ranAt: new Date().toISOString(),
				target: TARGET,
				wallet: account.address,
				count: COUNT,
				successful: ok,
				avgDurationMs: avgMs,
				avgDurationMsSuccess: avgOkMs,
				results,
			},
			null,
			2,
		),
	);
	console.log(`\nEvidence written to ${EVIDENCE_FILE}`);
	console.log(
		ok === COUNT
			? '✅ all paid requests settled'
			: `⚠️ ${COUNT - ok} failed — inspect evidence file`,
	);

	process.exit(ok === COUNT ? 0 : 2);
}

main().catch((err) => {
	console.error('[burst] FATAL', err);
	process.exit(1);
});
