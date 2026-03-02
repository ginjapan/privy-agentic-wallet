/**
 * Mock merchant / seller-agent API (x402-style payment gating)
 *
 * GET /api/shop
 *   → 402 Payment Required  (no payment)
 *   → 200 + product data    (X-Payment-Tx header present with valid tx)
 *
 * The real x402 protocol uses EIP-712 signed typed-data in X-PAYMENT header.
 * This demo uses a simplified flow: buyer sends ETH on-chain and provides
 * the tx hash, which the merchant verifies via Base Sepolia RPC.
 */

import { NextRequest, NextResponse } from "next/server";
import { MERCHANT_ADDRESS, PRICE_WEI, PAYMENT_REQUIREMENTS, verifyPayment, buildProduct } from "@/lib/shop";

export async function GET(req: NextRequest) {
  const txHash = req.headers.get("x-payment-tx");

  // No payment provided → 402
  if (!txHash) {
    return NextResponse.json(
      { error: "Payment Required", payment: PAYMENT_REQUIREMENTS },
      {
        status: 402,
        headers: {
          "X-Payment-Recipient": MERCHANT_ADDRESS,
          "X-Payment-Amount-Wei": PRICE_WEI.toString(),
          "X-Payment-Chain-Id": "84532",
        },
      }
    );
  }

  // Verify the payment on-chain
  const { valid, reason, value } = await verifyPayment(txHash);

  if (!valid) {
    return NextResponse.json(
      { error: "Payment verification failed", reason },
      { status: 402 }
    );
  }

  // Payment verified → deliver product
  return NextResponse.json(buildProduct(txHash, value!));
}
