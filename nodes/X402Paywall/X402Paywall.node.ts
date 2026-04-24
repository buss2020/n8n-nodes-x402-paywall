import type {
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

import { NETWORKS, getNetwork } from './networks';
import {
	buildPaymentRequiredBody,
	encodePaymentRequiredHeader,
} from './paymentRequirements';

/**
 * X402 Paywall trigger node.
 *
 * Task 8 scope (this commit): serve `402 Payment Required` on every
 * request. The facilitator-wired happy path + settlement comes in
 * Task 10. This skeleton exists so we can (a) install the package into
 * n8n, (b) confirm the node appears in the palette, (c) confirm a
 * curl against the webhook URL returns a valid 402 with
 * `X-PAYMENT-REQUIRED` base64 header.
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

		const credentials = await this.getCredentials('x402PaywallApi');
		const payTo = credentials.payToAddress as string;

		const priceUsd = this.getNodeParameter('priceUsd') as number;
		const networkKey = this.getNodeParameter('network') as string;
		const description = this.getNodeParameter('resourceDescription') as string;
		const mimeType = this.getNodeParameter('mimeType') as string;
		const maxTimeoutSeconds = this.getNodeParameter('maxTimeoutSeconds') as number;

		const network = getNetwork(networkKey);
		const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

		const body = buildPaymentRequiredBody({
			priceUsd,
			network,
			payTo,
			resourceUrl,
			description,
			mimeType,
			maxTimeoutSeconds,
		});

		// Task 8: always return 402. Task 10 will wire up verify/settle.
		res
			.status(402)
			.setHeader('X-PAYMENT-REQUIRED', encodePaymentRequiredHeader(body))
			.setHeader('Content-Type', 'application/json')
			.json(body);

		return { noWebhookResponse: true };
	}
}
