/** Serialized shape of the `PAYMENT-REQUIRED` header after base64 decode. */
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
	network: string; // "eip155:<chainId>"
	amount: string; // base units as string (e.g. "5000" = $0.005 USDC)
	asset: string; // USDC contract 0x...
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
	txHash: string;
	payer: string;
	amount: string;
	amountUsd: string;
	network: string;
	asset: string;
	settledAt: string; // ISO-8601
	facilitator: string;
}

/** Minimal shape of a facilitator /verify response (based on x402 spec). */
export interface FacilitatorVerifyResponse {
	valid: boolean;
	reason?: string;
	payer?: string;
	amount?: string;
}

/** Minimal shape of a facilitator /settle response. */
export interface FacilitatorSettleResponse {
	success: boolean;
	txHash?: string;
	payer?: string;
	amount?: string;
	settledAt?: string;
	reason?: string;
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
