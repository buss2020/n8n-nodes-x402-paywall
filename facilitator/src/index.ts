/**
 * Self-hosted x402 facilitator for Arc testnet (eip155:5042002).
 *
 * Why this exists:
 *   The public x402.org/facilitator does not (yet) support Arc. The hackathon
 *   mandate is Arc-native settlement. This small service instantiates the
 *   upstream @x402/core `x402Facilitator` runtime + @x402/evm `ExactEvmScheme`
 *   with a viem wallet pointed at Arc testnet RPC and exposes the canonical
 *   POST /verify, POST /settle, GET /supported wire endpoints.
 *
 * Route contracts are defined in @x402/core/types (VerifyRequest/Response,
 * SettleRequest/Response, SupportedResponse) — see
 * docs/research/2026-04-24-x402-arc-findings.md §4 for the authoritative shapes.
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import {
	createWalletClient,
	http,
	publicActions,
	type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { x402Facilitator } from '@x402/core/facilitator';
import { ExactEvmScheme } from '@x402/evm/exact/facilitator';
import { toFacilitatorEvmSigner } from '@x402/evm';

// -----------------------------------------------------------------------------
// Config (hardcoded for hackathon MVP)
// -----------------------------------------------------------------------------

const ARC_CHAIN_ID = 5042002;
const ARC_NETWORK = `eip155:${ARC_CHAIN_ID}` as const;
const ARC_RPC_URL = 'https://rpc.testnet.arc.network';

const PORT = Number(process.env.PORT ?? 3001);
const PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY;

if (!PRIVATE_KEY) {
	// eslint-disable-next-line no-console
	console.error('[facilitator] FATAL: FACILITATOR_PRIVATE_KEY env var is required');
	process.exit(1);
}

// -----------------------------------------------------------------------------
// viem wallet + facilitator runtime
// -----------------------------------------------------------------------------

const arcTestnet: Chain = {
	id: ARC_CHAIN_ID,
	name: 'Arc Testnet',
	nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
	rpcUrls: {
		default: { http: [ARC_RPC_URL] },
		public: { http: [ARC_RPC_URL] },
	},
	blockExplorers: {
		default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
	},
	testnet: true,
};

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

// Wallet client extended with public actions — provides every capability
// that FacilitatorEvmSigner requires (readContract, verifyTypedData,
// writeContract, sendTransaction, waitForTransactionReceipt, getCode).
const walletClient = createWalletClient({
	account,
	chain: arcTestnet,
	transport: http(ARC_RPC_URL),
}).extend(publicActions);

// `toFacilitatorEvmSigner` expects a top-level `address` property, but viem's
// wallet client keeps it on `.account.address`. We hoist it here. We also
// cast through `unknown` because viem's `verifyTypedData` types are stricter
// than FacilitatorEvmSigner's generic `Record<string, unknown>` — the runtime
// shape matches. Upstream: https://github.com/x402-foundation/x402
const signer = toFacilitatorEvmSigner({
	...walletClient,
	address: account.address,
} as unknown as Parameters<typeof toFacilitatorEvmSigner>[0]);

const facilitator = new x402Facilitator().register(
	ARC_NETWORK,
	new ExactEvmScheme(signer),
);

// -----------------------------------------------------------------------------
// Express app
// -----------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req: Request, res: Response) => {
	res.json({ ok: true, network: ARC_NETWORK, facilitator: account.address });
});

app.get('/supported', (_req: Request, res: Response) => {
	res.json(facilitator.getSupported());
});

app.post('/verify', async (req: Request, res: Response) => {
	const startedAt = Date.now();
	const { paymentPayload, paymentRequirements } = req.body ?? {};
	if (!paymentPayload || !paymentRequirements) {
		res.status(400).json({
			isValid: false,
			invalidReason: 'bad_request',
			invalidMessage: 'paymentPayload and paymentRequirements are required',
		});
		return;
	}
	try {
		const result = await facilitator.verify(paymentPayload, paymentRequirements);
		const duration = Date.now() - startedAt;
		// eslint-disable-next-line no-console
		console.log(
			`[verify] isValid=${result.isValid} payer=${result.payer ?? '-'} ` +
				`amount=${paymentRequirements?.amount ?? '-'} duration=${duration}ms`,
		);
		res.json(result);
	} catch (err) {
		const duration = Date.now() - startedAt;
		const message = err instanceof Error ? err.message : String(err);
		// eslint-disable-next-line no-console
		console.error(`[verify] EXCEPTION duration=${duration}ms: ${message}`);
		res.status(500).json({
			isValid: false,
			invalidReason: 'internal_error',
			invalidMessage: message,
		});
	}
});

app.post('/settle', async (req: Request, res: Response) => {
	const startedAt = Date.now();
	const { paymentPayload, paymentRequirements } = req.body ?? {};
	if (!paymentPayload || !paymentRequirements) {
		res.status(400).json({
			success: false,
			errorReason: 'bad_request',
			errorMessage: 'paymentPayload and paymentRequirements are required',
			transaction: '',
			network: ARC_NETWORK,
		});
		return;
	}
	try {
		const result = await facilitator.settle(paymentPayload, paymentRequirements);
		const duration = Date.now() - startedAt;
		// eslint-disable-next-line no-console
		console.log(
			`[settle] success=${result.success} tx=${result.transaction ?? '-'} ` +
				`payer=${result.payer ?? '-'} amount=${paymentRequirements?.amount ?? '-'} ` +
				`duration=${duration}ms`,
		);
		res.json(result);
	} catch (err) {
		const duration = Date.now() - startedAt;
		const message = err instanceof Error ? err.message : String(err);
		// eslint-disable-next-line no-console
		console.error(`[settle] EXCEPTION duration=${duration}ms: ${message}`);
		res.status(500).json({
			success: false,
			errorReason: 'internal_error',
			errorMessage: message,
			transaction: '',
			network: ARC_NETWORK,
		});
	}
});

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(
		`[facilitator] listening on :${PORT}  network=${ARC_NETWORK}  ` +
			`rpc=${ARC_RPC_URL}  signer=${account.address}`,
	);
});
