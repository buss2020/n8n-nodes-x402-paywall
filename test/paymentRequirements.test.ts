import { describe, it, expect } from 'vitest';
import {
	buildPaymentRequiredBody,
	encodePaymentRequiredHeader,
	decodePaymentSignatureHeader,
	dollarsToBaseUnits,
} from '../nodes/X402Paywall/paymentRequirements';
import { NETWORKS } from '../nodes/X402Paywall/networks';

describe('dollarsToBaseUnits', () => {
	it('converts $0.005 to 5000 base units (USDC 6 decimals)', () => {
		expect(dollarsToBaseUnits(0.005)).toBe('5000');
	});

	it('converts $1 to 1000000 base units', () => {
		expect(dollarsToBaseUnits(1)).toBe('1000000');
	});

	it('converts $0.01 to 10000', () => {
		expect(dollarsToBaseUnits(0.01)).toBe('10000');
	});

	it('throws on negative price', () => {
		expect(() => dollarsToBaseUnits(-0.01)).toThrow();
	});

	it('throws on zero price', () => {
		expect(() => dollarsToBaseUnits(0)).toThrow();
	});

	it('throws when price rounds below 1 base unit', () => {
		expect(() => dollarsToBaseUnits(0.00000001)).toThrow(/below 1 base unit/);
	});
});

describe('buildPaymentRequiredBody', () => {
	const base = {
		priceUsd: 0.005,
		network: NETWORKS.baseSepolia,
		payTo: '0x1234567890123456789012345678901234567890',
		resourceUrl: 'https://example.com/webhook/abc',
		description: 'Test paid endpoint',
		mimeType: 'application/json',
		maxTimeoutSeconds: 300,
	};

	it('emits x402Version=2 and scheme=exact', () => {
		const body = buildPaymentRequiredBody(base);
		expect(body.x402Version).toBe(2);
		expect(body.accepts).toHaveLength(1);
		expect(body.accepts[0].scheme).toBe('exact');
	});

	it('uses correct network id and USDC contract for Base Sepolia', () => {
		const body = buildPaymentRequiredBody(base);
		expect(body.accepts[0].network).toBe('eip155:84532');
		expect(body.accepts[0].asset).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
	});

	it('sets amount as base units string ($0.005 = "5000")', () => {
		const body = buildPaymentRequiredBody(base);
		expect(body.accepts[0].amount).toBe('5000');
	});

	it('preserves payTo, maxTimeoutSeconds, resource metadata', () => {
		const body = buildPaymentRequiredBody(base);
		expect(body.accepts[0].payTo).toBe(base.payTo);
		expect(body.accepts[0].maxTimeoutSeconds).toBe(300);
		expect(body.resource.url).toBe(base.resourceUrl);
		expect(body.resource.description).toBe(base.description);
		expect(body.resource.mimeType).toBe(base.mimeType);
	});

	it('includes extra.name=USDC and extra.version="2"', () => {
		const body = buildPaymentRequiredBody(base);
		expect(body.accepts[0].extra.name).toBe('USDC');
		expect(body.accepts[0].extra.version).toBe('2');
	});

	it('omits extra.facilitatorAddress when not provided', () => {
		const body = buildPaymentRequiredBody(base);
		expect(body.accepts[0].extra.facilitatorAddress).toBeUndefined();
	});

	it('includes extra.facilitatorAddress when provided', () => {
		const body = buildPaymentRequiredBody({
			...base,
			facilitatorAddress: '0xFAC1111111111111111111111111111111111111',
		});
		expect(body.accepts[0].extra.facilitatorAddress).toBe(
			'0xFAC1111111111111111111111111111111111111',
		);
	});
});

describe('encodePaymentRequiredHeader / decodePaymentSignatureHeader', () => {
	it('base64 round-trips the body', () => {
		const body = buildPaymentRequiredBody({
			priceUsd: 0.005,
			network: NETWORKS.baseSepolia,
			payTo: '0x1234567890123456789012345678901234567890',
			resourceUrl: 'https://example.com',
			description: 'Test',
			mimeType: 'application/json',
			maxTimeoutSeconds: 300,
		});
		const encoded = encodePaymentRequiredHeader(body);
		expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
		const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
		expect(decoded).toEqual(body);
	});

	it('decodePaymentSignatureHeader parses a base64-encoded JSON payload', () => {
		const payload = { signature: '0xabc', nonce: 'xyz' };
		const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
		expect(decodePaymentSignatureHeader(encoded)).toEqual(payload);
	});

	it('decodePaymentSignatureHeader throws on malformed base64', () => {
		expect(() => decodePaymentSignatureHeader('not-base64-{{}}')).toThrow();
	});
});
