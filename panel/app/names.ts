// Comprehension layer: every purchase gets a human name on camera.
// The raw vendor + sku stay visible as a mono sub-label (authenticity),
// but the primary read is always plain language.
export const PRODUCTS: Record<string, string> = {
  "oracle-price-eth": "ETH/USD oracle check · Base",
  "market-data-bulk": "Market data bundle · batch",
  "gas-check": "Multi-chain gas check",
};

export const VENDORS: Record<string, string> = {
  "x402.agentfund.net": "AgentFund · x402 data tools",
};

export function productOf(vendor: string, sku: string): string {
  if (PRODUCTS[sku]) return PRODUCTS[sku];
  if (VENDORS[vendor]) return `${VENDORS[vendor]} · ${sku}`;
  return sku || vendor;
}
