export interface NetworkConfig {
	id: string; // x402 network format: "eip155:<chainId>"
	displayName: string;
	chainId: number;
	usdcContract: string; // 0x...
	explorerUrl: string; // for building tx links (append txHash)
}

/**
 * Network config. Arc testnet values are FILLED IN by research agent
 * (docs/research/2026-04-24-x402-arc-findings.md). If Arc is not supported
 * by the public x402 facilitator, we fall back to Base Sepolia.
 */
export const NETWORKS: Record<string, NetworkConfig> = {
	baseSepolia: {
		id: 'eip155:84532',
		displayName: 'Base Sepolia',
		chainId: 84532,
		usdcContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
		explorerUrl: 'https://sepolia.basescan.org/tx/',
	},
	arcTestnet: {
		// PLACEHOLDER — overridden after research agent report. Keep keys intact
		// so UI dropdown always shows this option; unfilled values will raise at runtime.
		id: 'eip155:0',
		displayName: 'Arc Testnet',
		chainId: 0,
		usdcContract: '0x0000000000000000000000000000000000000000',
		explorerUrl: 'https://explorer.arc.network/tx/',
	},
};

export const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

export function getNetwork(key: string): NetworkConfig {
	const n = NETWORKS[key];
	if (!n) throw new Error(`Unknown network: ${key}`);
	if (n.chainId === 0) {
		throw new Error(
			`Network ${key} has placeholder config — update nodes/X402Paywall/networks.ts from research findings before use.`,
		);
	}
	return n;
}
