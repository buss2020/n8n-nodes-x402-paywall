import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class X402PaywallApi implements ICredentialType {
	name = 'x402PaywallApi';

	displayName = 'X402 Paywall API';

	documentationUrl = 'https://github.com/buss2020/n8n-nodes-x402-paywall#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Pay-To Address',
			name: 'payToAddress',
			type: 'string',
			default: '',
			required: true,
			placeholder: '0xYourWalletAddress',
			description: 'EVM address that receives USDC payments.',
		},
		{
			displayName: 'Facilitator URL',
			name: 'facilitatorUrl',
			type: 'string',
			default: 'https://x402.org/facilitator',
			description:
				'URL of the x402 facilitator service that verifies and settles payments.',
		},
		{
			displayName: 'Facilitator API Key',
			name: 'facilitatorApiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Optional API key for authenticated facilitator services. Leave empty for public testnet facilitator.',
		},
	];
}
