# Privy Agentic Wallet Demo

AI-powered wallet agent built on [Privy](https://privy.io) server wallets on Base Sepolia testnet.

## Features
- Create wallets with spending-limit policies
- Check ETH balances on Base Sepolia
- Send ETH (max 0.001 ETH/tx enforced by policy)
- Sign messages
- List wallets

## Stack
- Next.js 15 (App Router)
- Privy `@privy-io/node` SDK
- Anthropic Claude (tool_use agentic loop)
- Base Sepolia testnet + Tailwind CSS

## Setup

```bash
npm install
cp .env.example .env.local   # fill in credentials
npm run dev
```

### Environment variables

| Variable | Source |
|---|---|
| `PRIVY_APP_ID` | Privy Dashboard → Settings → Basics |
| `PRIVY_APP_SECRET` | Privy Dashboard → Settings → Basics |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

### Get testnet ETH
- https://www.alchemy.com/faucets/base-sepolia
- https://faucet.quicknode.com/base/sepolia

## Deploy to Vercel

**Vercel CLI:**
```bash
npx vercel
```

**Vercel Dashboard:**
1. Push to GitHub → import at vercel.com/new
2. Add env vars: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `ANTHROPIC_API_KEY`
3. Deploy

## Architecture
```
Chat UI → POST /api/agent
        → Claude tool_use loop
          → Privy server wallets API → Base Sepolia
```
