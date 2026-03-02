import { PrivyClient } from "@privy-io/node";

if (!process.env.PRIVY_APP_ID) throw new Error("Missing PRIVY_APP_ID");
if (!process.env.PRIVY_APP_SECRET) throw new Error("Missing PRIVY_APP_SECRET");

export const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
});
