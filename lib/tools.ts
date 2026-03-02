import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { privy } from "./privy";

// Base Sepolia CAIP-2
const BASE_SEPOLIA = "eip155:84532";

// ──────────────────────────────────────────────
// Claude tool schema definitions
// ──────────────────────────────────────────────

export const TOOLS: Tool[] = [
  {
    name: "create_wallet",
    description:
      "Create a new Ethereum wallet (Base Sepolia) with a spending-limit policy attached. Returns wallet ID and address.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_wallets",
    description: "List all Ethereum wallets in the Privy app.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_balance",
    description: "Get the ETH balance of a wallet on Base Sepolia.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The Privy wallet ID",
        },
      },
      required: ["wallet_id"],
    },
  },
  {
    name: "send_eth",
    description:
      "Send ETH on Base Sepolia from a wallet. Max 0.001 ETH per transaction (enforced by policy).",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The Privy wallet ID to send from",
        },
        to: {
          type: "string",
          description: "Recipient Ethereum address (0x...)",
        },
        value_eth: {
          type: "number",
          description: "Amount in ETH to send (max 0.001)",
        },
      },
      required: ["wallet_id", "to", "value_eth"],
    },
  },
  {
    name: "sign_message",
    description: "Sign an arbitrary text message with a wallet.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The Privy wallet ID",
        },
        message: {
          type: "string",
          description: "The message to sign",
        },
      },
      required: ["wallet_id", "message"],
    },
  },
  {
    name: "buy_product",
    description:
      "Buy a product from the merchant agent using x402-style payment. " +
      "The agent autonomously: (1) checks what payment is required, " +
      "(2) sends ETH from the wallet to the merchant, " +
      "(3) delivers the payment proof, and (4) receives the product. " +
      "Price is 0.0001 ETH on Base Sepolia.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The Privy wallet ID to pay from",
        },
      },
      required: ["wallet_id"],
    },
  },
];

// ──────────────────────────────────────────────
// Tool handlers
// ──────────────────────────────────────────────

async function createSpendingPolicy(): Promise<string> {
  // 0.001 ETH = 1_000_000_000_000_000 wei
  const MAX_VALUE = "1000000000000000";

  const policy = await privy.policies().create({
    chain_type: "ethereum",
    name: "Base Sepolia 0.001 ETH limit",
    version: "1.0",
    rules: [
      {
        name: "Max 0.001 ETH on Base Sepolia",
        method: "eth_sendTransaction",
        action: "ALLOW",
        conditions: [
          {
            field: "value",
            field_source: "ethereum_transaction",
            operator: "lte",
            value: MAX_VALUE,
          },
          {
            field: "chain_id",
            field_source: "ethereum_transaction",
            operator: "eq",
            value: "84532",
          },
        ],
      },
    ],
  });

  return policy.id;
}

export async function handleTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "create_wallet": {
      const policyId = await createSpendingPolicy();
      const wallet = await privy.wallets().create({
        chain_type: "ethereum",
        policy_ids: [policyId],
      });
      return {
        id: wallet.id,
        address: wallet.address,
        chain_type: wallet.chain_type,
        policy_id: policyId,
        note: "Wallet created with 0.001 ETH/tx spending limit on Base Sepolia",
      };
    }

    case "list_wallets": {
      const wallets = [];
      for await (const wallet of privy.wallets().list({ chain_type: "ethereum" })) {
        wallets.push({
          id: wallet.id,
          address: wallet.address,
          chain_type: wallet.chain_type,
        });
      }
      return { wallets, count: wallets.length };
    }

    case "get_balance": {
      const { wallet_id } = toolInput as { wallet_id: string };
      const result = await privy
        .wallets()
        .balance.get(wallet_id, { chain: "base_sepolia", asset: "eth" });
      const balance = result.balances[0];
      return balance
        ? {
            asset: balance.asset,
            chain: balance.chain,
            raw_value: balance.raw_value,
            display: balance.display_values,
          }
        : { message: "No balance found" };
    }

    case "send_eth": {
      const { wallet_id, to, value_eth } = toolInput as {
        wallet_id: string;
        to: string;
        value_eth: number;
      };
      // Convert ETH to hex wei
      const weiValue = BigInt(Math.floor(value_eth * 1e18));
      const hexValue = "0x" + weiValue.toString(16);

      const result = await privy.wallets().ethereum().sendTransaction(
        wallet_id,
        {
          caip2: BASE_SEPOLIA,
          params: {
            transaction: {
              to,
              value: hexValue,
              chain_id: 84532,
            },
          },
        }
      );
      return {
        hash: result.hash,
        explorer: `https://sepolia.basescan.org/tx/${result.hash}`,
      };
    }

    case "sign_message": {
      const { wallet_id, message } = toolInput as {
        wallet_id: string;
        message: string;
      };
      const result = await privy.wallets().ethereum().signMessage(
        wallet_id,
        { message }
      );
      return { signature: result.signature };
    }

    case "buy_product": {
      const { wallet_id } = toolInput as { wallet_id: string };
      const shopUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/shop`
        : "http://localhost:3000/api/shop";

      // Step 1: Discover payment requirements (will get 402)
      const probe = await fetch(shopUrl);
      if (probe.status !== 402) {
        const data = await probe.json();
        return { message: "Unexpected response", data };
      }
      const { payment } = await probe.json();

      // Step 2: Pay the merchant autonomously
      const weiValue = BigInt(payment.price_wei);
      const hexValue = "0x" + weiValue.toString(16);
      const payResult = await privy.wallets().ethereum().sendTransaction(
        wallet_id,
        {
          caip2: BASE_SEPOLIA,
          params: {
            transaction: {
              to: payment.recipient,
              value: hexValue,
              chain_id: 84532,
            },
          },
        }
      );

      // Step 3: Present payment proof, receive product
      const purchase = await fetch(shopUrl, {
        headers: { "X-Payment-Tx": payResult.hash },
      });
      const product = await purchase.json();

      if (!purchase.ok) {
        return {
          error: "Payment sent but verification failed",
          tx_hash: payResult.hash,
          reason: product.reason,
          note: "The tx may need a few seconds to be mined. Try again shortly.",
        };
      }

      return {
        success: true,
        paid_eth: payment.price_eth,
        tx_hash: payResult.hash,
        explorer: `https://sepolia.basescan.org/tx/${payResult.hash}`,
        product,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
