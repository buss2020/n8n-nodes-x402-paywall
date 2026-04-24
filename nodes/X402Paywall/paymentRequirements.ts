import type { PaymentRequiredBody, PaymentRequirementsEntry } from './types';
import type { NetworkConfig } from './networks';

const USDC_DECIMALS = 6;

export function dollarsToBaseUnits(priceUsd: number): string {
	if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
		throw new Error(`Invalid price: ${priceUsd}. Must be positive finite number.`);
	}
	const base = Math.floor(priceUsd * 10 ** USDC_DECIMALS);
	if (base < 1) {
		throw new Error(`Price ${priceUsd} rounds below 1 base unit; increase price.`);
	}
	return String(base);
}

export interface BuildPaymentRequiredOptions {
	priceUsd: number;
	network: NetworkConfig;
	payTo: string;
	resourceUrl: string;
	description: string;
	mimeType: string;
	maxTimeoutSeconds: number;
	facilitatorAddress?: string;
}

export function buildPaymentRequiredBody(opts: BuildPaymentRequiredOptions): PaymentRequiredBody {
	const entry: PaymentRequirementsEntry = {
		scheme: 'exact',
		network: opts.network.id,
		amount: dollarsToBaseUnits(opts.priceUsd),
		asset: opts.network.usdcContract,
		payTo: opts.payTo,
		maxTimeoutSeconds: opts.maxTimeoutSeconds,
		extra: {
			name: 'USDC',
			version: '2',
			...(opts.facilitatorAddress ? { facilitatorAddress: opts.facilitatorAddress } : {}),
		},
	};

	return {
		x402Version: 2,
		error: 'Payment required',
		resource: {
			url: opts.resourceUrl,
			description: opts.description,
			mimeType: opts.mimeType,
		},
		accepts: [entry],
	};
}

export function encodePaymentRequiredHeader(body: PaymentRequiredBody): string {
	return Buffer.from(JSON.stringify(body), 'utf-8').toString('base64');
}

export function decodePaymentSignatureHeader(header: string): unknown {
	let decoded: string;
	try {
		decoded = Buffer.from(header, 'base64').toString('utf-8');
	} catch (err) {
		throw new Error(`malformed PAYMENT-SIGNATURE base64: ${(err as Error).message}`);
	}
	try {
		return JSON.parse(decoded);
	} catch (err) {
		throw new Error(`malformed PAYMENT-SIGNATURE JSON: ${(err as Error).message}`);
	}
}
