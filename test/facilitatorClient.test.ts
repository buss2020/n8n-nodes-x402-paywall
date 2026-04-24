import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { FacilitatorClient } from '../nodes/X402Paywall/facilitatorClient';
import { X402TimeoutError, X402FacilitatorError } from '../nodes/X402Paywall/types';

const FAC_URL = 'https://facilitator.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Minimal valid-ish fixtures (types enforce shape at runtime the caller
// doesn't care about — FacilitatorClient only forwards the bytes).
const fakePayload = { x402Version: 2, scheme: 'exact', network: 'eip155:84532' };
const fakeRequirements = {
	scheme: 'exact' as const,
	network: 'eip155:84532',
	amount: '5000',
	asset: '0x0',
	payTo: '0x0',
	maxTimeoutSeconds: 300,
	extra: { name: 'USDC' as const, version: '2' as const },
};

describe('FacilitatorClient.verify', () => {
	it('returns isValid=true on 200', async () => {
		server.use(
			http.post(`${FAC_URL}/verify`, () =>
				HttpResponse.json({ isValid: true, payer: '0xabc' }),
			),
		);
		const client = new FacilitatorClient({ url: FAC_URL });
		const result = await client.verify(fakePayload, fakeRequirements);
		expect(result.isValid).toBe(true);
		expect(result.payer).toBe('0xabc');
	});

	it('surfaces invalidReason on rejection', async () => {
		server.use(
			http.post(`${FAC_URL}/verify`, () =>
				HttpResponse.json({
					isValid: false,
					invalidReason: 'insufficient_funds',
					invalidMessage: 'Payer balance too low',
				}),
			),
		);
		const client = new FacilitatorClient({ url: FAC_URL });
		const result = await client.verify(fakePayload, fakeRequirements);
		expect(result.isValid).toBe(false);
		expect(result.invalidReason).toBe('insufficient_funds');
		expect(result.invalidMessage).toBe('Payer balance too low');
	});

	it('throws X402FacilitatorError on 5xx after exhausting retries', async () => {
		server.use(
			http.post(`${FAC_URL}/verify`, () =>
				HttpResponse.text('internal error', { status: 500 }),
			),
		);
		const client = new FacilitatorClient({ url: FAC_URL, maxRetries: 0 });
		await expect(client.verify(fakePayload, fakeRequirements)).rejects.toBeInstanceOf(
			X402FacilitatorError,
		);
	});

	it('throws X402TimeoutError when request exceeds verifyTimeoutMs', async () => {
		server.use(
			http.post(`${FAC_URL}/verify`, async () => {
				await new Promise((r) => setTimeout(r, 500));
				return HttpResponse.json({ isValid: true });
			}),
		);
		const client = new FacilitatorClient({
			url: FAC_URL,
			verifyTimeoutMs: 50,
			maxRetries: 0,
		});
		await expect(client.verify(fakePayload, fakeRequirements)).rejects.toBeInstanceOf(
			X402TimeoutError,
		);
	});

	it('retries 502 responses and succeeds on the second attempt', async () => {
		let attempts = 0;
		server.use(
			http.post(`${FAC_URL}/verify`, () => {
				attempts += 1;
				if (attempts === 1) return HttpResponse.text('bad gateway', { status: 502 });
				return HttpResponse.json({ isValid: true });
			}),
		);
		const client = new FacilitatorClient({ url: FAC_URL, maxRetries: 2 });
		const result = await client.verify(fakePayload, fakeRequirements);
		expect(result.isValid).toBe(true);
		expect(attempts).toBe(2);
	});

	it('sends Authorization header when apiKey is provided', async () => {
		let observedAuth: string | null = null;
		server.use(
			http.post(`${FAC_URL}/verify`, ({ request }) => {
				observedAuth = request.headers.get('authorization');
				return HttpResponse.json({ isValid: true });
			}),
		);
		const client = new FacilitatorClient({ url: FAC_URL, apiKey: 'secret-token' });
		await client.verify(fakePayload, fakeRequirements);
		expect(observedAuth).toBe('Bearer secret-token');
	});
});

describe('FacilitatorClient.settle', () => {
	it('returns transaction hash on success', async () => {
		server.use(
			http.post(`${FAC_URL}/settle`, () =>
				HttpResponse.json({
					success: true,
					transaction: '0xdeadbeef',
					payer: '0xabc',
					amount: '5000',
					network: 'eip155:84532',
				}),
			),
		);
		const client = new FacilitatorClient({ url: FAC_URL });
		const result = await client.settle(fakePayload, fakeRequirements);
		expect(result.success).toBe(true);
		expect(result.transaction).toBe('0xdeadbeef');
		expect(result.network).toBe('eip155:84532');
	});

	it('surfaces errorReason + errorMessage on onchain failure', async () => {
		server.use(
			http.post(`${FAC_URL}/settle`, () =>
				HttpResponse.json({
					success: false,
					errorReason: 'onchain_revert',
					errorMessage: 'USDC transfer reverted: insufficient allowance',
				}),
			),
		);
		const client = new FacilitatorClient({ url: FAC_URL });
		const result = await client.settle(fakePayload, fakeRequirements);
		expect(result.success).toBe(false);
		expect(result.errorReason).toBe('onchain_revert');
	});
});

describe('FacilitatorClient URL normalization', () => {
	it('strips trailing slashes from the base URL', async () => {
		server.use(
			http.post(`${FAC_URL}/verify`, () => HttpResponse.json({ isValid: true })),
		);
		const client = new FacilitatorClient({ url: `${FAC_URL}///` });
		const result = await client.verify(fakePayload, fakeRequirements);
		expect(result.isValid).toBe(true);
	});
});
