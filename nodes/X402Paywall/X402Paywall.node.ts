import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

import { NETWORKS, getNetwork, DEFAULT_FACILITATOR_URL } from './networks';
import {
	buildPaymentRequiredBody,
	encodePaymentRequiredHeader,
	decodePaymentSignatureHeader,
} from './paymentRequirements';
import { FacilitatorClient } from './facilitatorClient';
import { X402TimeoutError } from './types';

/**
 * X402 Paywall trigger node.
 *
 * Webhook flow:
 * 1. Client requests the webhook URL without X-PAYMENT header
 *    → node responds 402 + X-PAYMENT-REQUIRED base64 body.
 *    Workflow is NOT triggered.
 * 2. Client decodes the 402, signs a paymentPayload (EIP-3009
 *    TransferWithAuthorization for x402 "exact" scheme), retries
 *    with X-PAYMENT header.
 * 3. Node decodes the signature header, calls facilitator /verify.
 *    If invalid, responds 402 again with the facilitator's reason.
 * 4. On valid, node calls facilitator /settle. If settlement fails,
 *    responds 502 (network/timeout) or 402 (invalid). If succeeds,
 *    triggers downstream workflow with payment metadata; the
 *    workflow's final node output is returned to the client with
 *    X-PAYMENT-RESPONSE header.
 */
export class X402Paywall implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'X402 Paywall',
		name: 'x402Paywall',
		icon: 'file:x402.svg',
		group: ['trigger'],
		version: 1,
		description:
			'Paywall trigger: turn this workflow into a pay-per-call USDC endpoint via x402.',
		defaults: { name: 'X402 Paywall' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'x402PaywallApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: '={{$parameter["httpMethod"]}}',
				isFullPath: true,
				responseMode: '={{$parameter["responseMode"]}}',
				path: '={{$parameter["path"]}}',
			},
		],
		properties: [
			{
				displayName: 'HTTP Method',
				name: 'httpMethod',
				type: 'options',
				options: [
					{ name: 'GET', value: 'GET' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
					{ name: 'DELETE', value: 'DELETE' },
					{ name: 'PATCH', value: 'PATCH' },
				],
				default: 'GET',
				description: 'HTTP method this paywall accepts.',
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: '',
				placeholder: 'paid-api',
				description:
					'URL path suffix for this webhook. Leave empty for n8n to auto-generate.',
			},
			{
				displayName: 'Price (USD)',
				name: 'priceUsd',
				type: 'number',
				typeOptions: { numberPrecision: 6 },
				default: 0.005,
				description:
					'Per-request price in US dollars. Settled as USDC. Hackathon rules: ≤ $0.01.',
			},
			{
				displayName: 'Network',
				name: 'network',
				type: 'options',
				options: Object.entries(NETWORKS).map(([key, cfg]) => ({
					name: cfg.displayName,
					value: key,
				})),
				default: 'arcTestnet',
				description: 'Blockchain network for settlement.',
			},
			{
				displayName: 'Resource Description',
				name: 'resourceDescription',
				type: 'string',
				default: 'Paid API endpoint',
				description: 'Shown to the client in the 402 response.',
			},
			{
				displayName: 'MIME Type',
				name: 'mimeType',
				type: 'string',
				default: 'application/json',
				description: 'Content-Type of the paid response body.',
			},
			{
				displayName: 'Max Timeout (seconds)',
				name: 'maxTimeoutSeconds',
				type: 'number',
				default: 300,
				description: 'How long the client has to sign and retry.',
			},
			{
				displayName: 'Response Mode',
				name: 'responseMode',
				type: 'options',
				options: [
					{ name: 'When Last Node Finishes', value: 'lastNode' },
					{ name: 'On Received', value: 'onReceived' },
				],
				default: 'lastNode',
			},
			{
				displayName: 'Advanced',
				name: 'advanced',
				type: 'collection',
				default: {},
				placeholder: 'Add option',
				options: [
					{
						displayName: 'Skip Settlement',
						name: 'skipSettlement',
						type: 'boolean',
						default: false,
						description:
							'If enabled, only verify the payment — do not settle onchain. Useful for testing.',
					},
					{
						displayName: 'Facilitator URL Override',
						name: 'facilitatorUrlOverride',
						type: 'string',
						default: '',
						description:
							'Override the facilitator URL from credentials for this specific node.',
					},
				],
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const logger = this.logger;
		const logPrefix = '[X402Paywall]';

		const credentials = await this.getCredentials('x402PaywallApi');
		const payTo = credentials.payToAddress as string;
		const credFacilitator = credentials.facilitatorUrl as string;
		const facilitatorApiKey = (credentials.facilitatorApiKey as string) ?? '';

		const priceUsd = this.getNodeParameter('priceUsd') as number;
		const networkKey = this.getNodeParameter('network') as string;
		const description = this.getNodeParameter('resourceDescription') as string;
		const mimeType = this.getNodeParameter('mimeType') as string;
		const maxTimeoutSeconds = this.getNodeParameter('maxTimeoutSeconds') as number;
		const advanced = (this.getNodeParameter('advanced', {}) as IDataObject) ?? {};
		const skipSettlement = (advanced.skipSettlement as boolean) ?? false;
		const facilitatorUrlOverride = (advanced.facilitatorUrlOverride as string) ?? '';

		const network = getNetwork(networkKey);
		const facilitatorUrl =
			facilitatorUrlOverride || credFacilitator || DEFAULT_FACILITATOR_URL;
		const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

		const prBody = buildPaymentRequiredBody({
			priceUsd,
			network,
			payTo,
			resourceUrl,
			description,
			mimeType,
			maxTimeoutSeconds,
		});
		const paymentRequirements = prBody.accepts[0];

		const signatureHeader =
			(req.headers['x-payment'] as string | undefined) ??
			(req.headers['X-PAYMENT'] as string | undefined);

		// ---- 1. No signature — respond 402 and stop.
		if (!signatureHeader) {
			logger.info(`${logPrefix} 402 issued path=${req.originalUrl} reason=no_signature`);
			res
				.status(402)
				.setHeader('X-PAYMENT-REQUIRED', encodePaymentRequiredHeader(prBody))
				.setHeader('Content-Type', 'application/json')
				.json(prBody);
			return { noWebhookResponse: true };
		}

		// ---- 2. Decode the signature payload.
		let paymentPayload: unknown;
		try {
			paymentPayload = decodePaymentSignatureHeader(signatureHeader);
		} catch (err) {
			logger.warn(`${logPrefix} 400 malformed signature err=${(err as Error).message}`);
			res.status(400).json({ error: 'malformed X-PAYMENT header' });
			return { noWebhookResponse: true };
		}

		const client = new FacilitatorClient({
			url: facilitatorUrl,
			apiKey: facilitatorApiKey || undefined,
		});

		// ---- 3. Verify.
		let verifyStart = Date.now();
		try {
			const verifyResult = await client.verify(paymentPayload, paymentRequirements);
			logger.info(
				`${logPrefix} verify durationMs=${Date.now() - verifyStart} isValid=${verifyResult.isValid} payer=${verifyResult.payer ?? 'n/a'}`,
			);
			if (!verifyResult.isValid) {
				const errMsg = `Payment verification failed: ${verifyResult.invalidReason ?? 'unknown'}${verifyResult.invalidMessage ? ': ' + verifyResult.invalidMessage : ''}`;
				logger.info(`${logPrefix} 402 verify rejected reason=${verifyResult.invalidReason}`);
				const rejectedBody = { ...prBody, error: errMsg };
				res
					.status(402)
					.setHeader('X-PAYMENT-REQUIRED', encodePaymentRequiredHeader(rejectedBody))
					.setHeader('Content-Type', 'application/json')
					.json(rejectedBody);
				return { noWebhookResponse: true };
			}
		} catch (err) {
			const isTimeout = err instanceof X402TimeoutError;
			const msg = (err as Error).message;
			logger.error(`${logPrefix} ${isTimeout ? '504' : '502'} verify stage err=${msg}`);
			res
				.status(isTimeout ? 504 : 502)
				.json({ error: isTimeout ? 'facilitator verify timeout' : 'facilitator verify failed', detail: msg });
			return { noWebhookResponse: true };
		}

		// ---- 4. Settle (unless skipSettlement mode).
		let settleResult: {
			transaction: string;
			payer: string;
			amount: string;
			settledAt: string;
		};

		if (skipSettlement) {
			settleResult = {
				transaction: 'skip_settlement_mode',
				payer: 'unknown',
				amount: paymentRequirements.amount,
				settledAt: new Date().toISOString(),
			};
			logger.info(`${logPrefix} settle skipped (skipSettlement=true)`);
		} else {
			let settleStart = Date.now();
			try {
				const r = await client.settle(paymentPayload, paymentRequirements);
				logger.info(
					`${logPrefix} settle durationMs=${Date.now() - settleStart} success=${r.success} tx=${r.transaction ?? 'none'}`,
				);
				if (!r.success || !r.transaction) {
					logger.error(
						`${logPrefix} 502 settle failed reason=${r.errorReason} msg=${r.errorMessage}`,
					);
					res.status(502).json({
						error: 'settlement failed',
						detail: r.errorReason ?? 'unknown',
						message: r.errorMessage,
					});
					return { noWebhookResponse: true };
				}
				settleResult = {
					transaction: r.transaction,
					payer: r.payer ?? 'unknown',
					amount: r.amount ?? paymentRequirements.amount,
					settledAt: new Date().toISOString(),
				};
			} catch (err) {
				const isTimeout = err instanceof X402TimeoutError;
				const msg = (err as Error).message;
				logger.error(`${logPrefix} ${isTimeout ? '504' : '502'} settle stage err=${msg}`);
				res
					.status(isTimeout ? 504 : 502)
					.json({ error: isTimeout ? 'settlement timeout' : 'settlement failed', detail: msg });
				return { noWebhookResponse: true };
			}
		}

		// ---- 5. Write X-PAYMENT-RESPONSE header.
		const paymentResponsePayload = Buffer.from(
			JSON.stringify({
				success: true,
				transaction: settleResult.transaction,
				payer: settleResult.payer,
				amount: settleResult.amount,
				network: network.id,
				settledAt: settleResult.settledAt,
			}),
			'utf-8',
		).toString('base64');
		res.setHeader('X-PAYMENT-RESPONSE', paymentResponsePayload);

		// ---- 6. Trigger workflow with payment metadata merged in.
		const output: IDataObject = {
			headers: req.headers as unknown as IDataObject,
			body: req.body as IDataObject,
			query: req.query as IDataObject,
			params: req.params as IDataObject,
			payment: {
				transaction: settleResult.transaction,
				payer: settleResult.payer,
				amount: settleResult.amount,
				amountUsd: priceUsd.toString(),
				network: network.id,
				asset: network.usdcContract,
				settledAt: settleResult.settledAt,
				facilitator: facilitatorUrl,
			},
		};

		return { workflowData: [[{ json: output }]] };
	}
}
