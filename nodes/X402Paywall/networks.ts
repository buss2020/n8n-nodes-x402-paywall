/**
 * Network configuration for the x402 paywall. Values verified against
 * docs/research/2026-04-24-x402-arc-findings.md (Arc official docs +
 * Circle faucet + thirdweb chain registry, fetched 2026-04-24).
 */

export interface NetworkConfig {
	id: string; // CAIP-2 network id "eip155:<chainId>"
	displayName: string;
	chainId: number;
	rpcUrl: string;
	usdcContract: string;
	explorerUrl: string; // append tx hash
}

export const NETWORKS: Record<string, NetworkConfig> = {
	arcTestnet: {
		id: 'eip155:5042002',
		displayName: 'Arc Testnet',
		chainId: 5042002,
		rpcUrl: 'https://rpc.testnet.arc.network',
		usdcContract: '0x3600000000000000000000000000000000000000',
		explorerUrl: 'https://testnet.arcscan.app/tx/',
	},
	baseSepolia: {
		id: 'eip155:84532',
		displayName: 'Base Sepolia',
		chainId: 84532,
		rpcUrl: 'https://sepolia.base.org',
		usdcContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
		explorerUrl: 'https://sepolia.basescan.org/tx/',
	},
};

export const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

export function getNetwork(key: string): NetworkConfig {
	const n = NETWORKS[key];
	if (!n) throw new Error(`Unknown network: ${key}`);
	return n;
}
