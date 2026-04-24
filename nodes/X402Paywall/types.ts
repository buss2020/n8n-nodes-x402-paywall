/**
 * Types for the x402 paywall trigger node. Field names mirror the
 * upstream @x402/core@2.10.0 wire format (verified via docs/research/
 * 2026-04-24-x402-arc-findings.md).
 */

/** Body we serialize for 402 responses (sent as JSON body AND as `X-PAYMENT-REQUIRED` base64 header). */
export interface PaymentRequiredBody {
	x402Version: 2;
	error: string;
	resource: {
		url: string;
		description: string;
		mimeType: string;
	};
	accepts: PaymentRequirementsEntry[];
}

export interface PaymentRequirementsEntry {
	scheme: 'exact';
	network: string; // CAIP-2 "eip155:<chainId>"
	amount: string; // base units as string (e.g. "5000" = $0.005 USDC)
	asset: string; // USDC ERC-20 contract
	payTo: string; // recipient 0x...
	maxTimeoutSeconds: number;
	extra: {
		name: 'USDC';
		version: '2';
		facilitatorAddress?: string;
	};
}

/** Output emitted to downstream workflow on successful settlement. */
export interface SettlementOutput {
	/** onchain tx hash */
	transaction: string;
	/** payer EVM address */
	payer: string;
	/** settled amount in base units (string) */
	amount: string;
	/** the originally-requested USD amount for readability */
	amountUsd: string;
	/** CAIP-2 network id */
	network: string;
	/** USDC contract */
	asset: string;
	/** ISO-8601 timestamp (server-local) */
	settledAt: string;
	/** facilitator URL that settled the payment */
	facilitator: string;
}

/** POST /verify response from the facilitator. Matches @x402/core/types VerifyResponse. */
export interface FacilitatorVerifyResponse {
	isValid: boolean;
	invalidReason?: string;
	invalidMessage?: string;
	payer?: string;
	extensions?: Record<string, unknown>;
}

/** POST /settle response from the facilitator. Matches @x402/core/types SettleResponse. */
export interface FacilitatorSettleResponse {
	success: boolean;
	/** tx hash (always present on success; possibly absent on failure) */
	transaction?: string;
	network?: string;
	payer?: string;
	amount?: string;
	errorReason?: string;
	errorMessage?: string;
	extensions?: Record<string, unknown>;
}

export class X402TimeoutError extends Error {
	constructor(public readonly stage: 'verify' | 'settle') {
		super(`X402 facilitator ${stage} timed out`);
		this.name = 'X402TimeoutError';
	}
}

export class X402FacilitatorError extends Error {
	constructor(
		public readonly stage: 'verify' | 'settle',
		public readonly statusCode: number,
		public readonly body: string,
	) {
		super(`X402 facilitator ${stage} returned ${statusCode}: ${body}`);
		this.name = 'X402FacilitatorError';
	}
}
