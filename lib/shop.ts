export const MERCHANT_ADDRESS = "0x557925d2C45793a678F94D4B638251E537Fa6dB8";
export const PRICE_WEI = BigInt("10000000000000"); // 0.00001 ETH
const BASE_SEPOLIA_RPC = "https://sepolia.base.org";

export const PAYMENT_REQUIREMENTS = {
  protocol: "x402-simplified",
  description: "Premium weather data for Base Sepolia",
  price_eth: "0.00001",
  price_wei: PRICE_WEI.toString(),
  recipient: MERCHANT_ADDRESS,
  chain: "Base Sepolia (84532)",
  instructions:
    "Send exactly 0.00001 ETH to the recipient address on Base Sepolia, then retry with X-Payment-Tx: <txHash>",
};

export async function verifyPayment(txHash: string): Promise<{
  valid: boolean;
  reason?: string;
  value?: bigint;
}> {
  try {
    const res = await fetch(BASE_SEPOLIA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
    });
    const { result } = await res.json();

    if (!result) return { valid: false, reason: "Transaction not found or not yet mined" };
    if (result.status !== "0x1") return { valid: false, reason: "Transaction reverted" };

    const toRes = await fetch(BASE_SEPOLIA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getTransactionByHash",
        params: [txHash],
      }),
    });
    const { result: tx } = await toRes.json();

    if (!tx) return { valid: false, reason: "Transaction details not found" };
    if (tx.to?.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
      return { valid: false, reason: `Recipient mismatch: expected ${MERCHANT_ADDRESS}` };
    }

    const value = BigInt(tx.value);
    if (value < PRICE_WEI) {
      return {
        valid: false,
        reason: `Insufficient payment: sent ${value} wei, need ${PRICE_WEI} wei`,
      };
    }

    return { valid: true, value };
  } catch {
    return { valid: false, reason: "RPC error verifying transaction" };
  }
}

export function buildProduct(txHash: string, value: bigint) {
  return {
    product: "Premium Weather Data",
    data: {
      location: "Base Sepolia Network",
      temperature: "23°C",
      condition: "Partly Cloudy",
      humidity: "62%",
      wind: "14 km/h NW",
      forecast: ["Sunny", "Rain", "Cloudy", "Sunny", "Thunderstorm"],
      source: "Agent Commerce Demo",
      paid_wei: value.toString(),
      tx_hash: txHash,
      explorer: `https://sepolia.basescan.org/tx/${txHash}`,
    },
    message: "Payment verified on Base Sepolia. Here is your premium data!",
  };
}
