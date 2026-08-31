import { env } from "@/lib/env";

import { GatewayPaymentProvider } from "./gateway-provider";
import { ManualPaymentProvider } from "./manual-provider";
import type { PaymentProvider } from "./types";

export * from "./types";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const config = env();

  cached =
    config.PAYMENT_PROVIDER === "gateway"
      ? new GatewayPaymentProvider({
          endpoint: config.PAYMENT_GATEWAY_ENDPOINT!,
          merchantId: config.PAYMENT_GATEWAY_MERCHANT_ID!,
          apiKey: config.PAYMENT_GATEWAY_API_KEY!,
          webhookSecret: config.PAYMENT_GATEWAY_WEBHOOK_SECRET,
          returnUrl: `${config.APP_URL}/checkout/return`,
        })
      : new ManualPaymentProvider();

  return cached;
}
