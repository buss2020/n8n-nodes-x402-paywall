import {
	FacilitatorVerifyResponse,
	FacilitatorSettleResponse,
	X402TimeoutError,
	X402FacilitatorError,
} from './types';

export interface FacilitatorClientOptions {
	url: string;
	apiKey?: string;
	verifyTimeoutMs?: number;
	settleTimeoutMs?: number;
	maxRetries?: number;
	x402Version?: number;
}

/**
 * HTTP wrapper for an x402 facilitator service. Handles:
 * - timeout via AbortController
 * - retry on 5xx with exponential backoff
 * - typed errors (X402TimeoutError, X402FacilitatorError)
 *
 * Talks POST JSON to {url}/verify and {url}/settle. Response shapes
 * match @x402/core@2.10.0 wire format.
 */
export class FacilitatorClient {
	private readonly url: string;
	private readonly apiKey: string;
	private readonly verifyTimeoutMs: number;
	private readonly settleTimeoutMs: number;
	private readonly maxRetries: number;
	private readonly x402Version: number;

	constructor(opts: FacilitatorClientOptions) {
		this.url = opts.url.replace(/\/+$/, '');
		this.apiKey = opts.apiKey ?? '';
		this.verifyTimeoutMs = opts.verifyTimeoutMs ?? 10_000;
		this.settleTimeoutMs = opts.settleTimeoutMs ?? 30_000;
		this.maxRetries = opts.maxRetries ?? 2;
		this.x402Version = opts.x402Version ?? 2;
	}

	async verify(
		paymentPayload: unknown,
		paymentRequirements: unknown,
	): Promise<FacilitatorVerifyResponse> {
		return this.call<FacilitatorVerifyResponse>(
			'/verify',
			{ x402Version: this.x402Version, paymentPayload, paymentRequirements },
			this.verifyTimeoutMs,
			'verify',
		);
	}

	async settle(
		paymentPayload: unknown,
		paymentRequirements: unknown,
	): Promise<FacilitatorSettleResponse> {
		return this.call<FacilitatorSettleResponse>(
			'/settle',
			{ x402Version: this.x402Version, paymentPayload, paymentRequirements },
			this.settleTimeoutMs,
			'settle',
		);
	}

	private async call<T>(
		path: string,
		body: unknown,
		timeoutMs: number,
		stage: 'verify' | 'settle',
	): Promise<T> {
		const endpoint = `${this.url}${path}`;
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);

			try {
				const res = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				});
				clearTimeout(timer);

				if (res.status >= 500) {
					const text = await res.text().catch(() => '');
					lastError = new X402FacilitatorError(stage, res.status, text);
					if (attempt < this.maxRetries) {
						await sleep(100 * 2 ** attempt);
						continue;
					}
					throw lastError;
				}

				if (!res.ok) {
					const text = await res.text().catch(() => '');
					throw new X402FacilitatorError(stage, res.status, text);
				}

				return (await res.json()) as T;
			} catch (err) {
				clearTimeout(timer);
				if ((err as Error).name === 'AbortError') {
					throw new X402TimeoutError(stage);
				}
				if (err instanceof X402FacilitatorError) {
					throw err;
				}
				lastError = err as Error;
				if (attempt >= this.maxRetries) throw err;
				await sleep(100 * 2 ** attempt);
			}
		}

		throw lastError ?? new Error(`${stage} failed after ${this.maxRetries} retries`);
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
