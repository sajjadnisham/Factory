import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  PaymentConfirmation,
  PaymentContext,
  PaymentInstruction,
  PaymentProvider,
} from "./types";

export interface GatewayConfig {
  endpoint: string;
  merchantId: string;
  apiKey: string;
  webhookSecret?: string;
  returnUrl: string;
}

/**
 * Hosted-checkout gateway adapter.
 *
 * Written against the shape most Maldivian card gateways use (create a session,
 * redirect, verify server-side, receive a signed webhook). When the store owner
 * names the actual provider, only the request/response mapping in this file
 * needs adjusting — no caller changes.
 */
export class GatewayPaymentProvider implements PaymentProvider {
  readonly name = "gateway";

  constructor(private readonly config: GatewayConfig) {}

  supportedMethods(): string[] {
    return ["card"];
  }

  async initiate(
    context: PaymentContext,
    method: string,
  ): Promise<PaymentInstruction> {
    const response = await fetch(`${this.config.endpoint}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        merchantId: this.config.merchantId,
        amount: context.amountMinor,
        currency: context.currency,
        reference: context.orderNumber,
        returnUrl: `${this.config.returnUrl}?order=${encodeURIComponent(context.orderNumber)}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Payment gateway rejected the request (HTTP ${response.status})`);
    }

    const data = (await response.json()) as {
      redirectUrl?: string;
      sessionId?: string;
    };

    if (!data.redirectUrl) {
      throw new Error("Payment gateway did not return a redirect URL.");
    }

    return {
      kind: "redirect",
      method,
      status: "pending",
      redirectUrl: data.redirectUrl,
      reference: data.sessionId ?? context.orderNumber,
    };
  }

  async confirm(
    context: PaymentContext,
    providerRef: string,
  ): Promise<PaymentConfirmation> {
    const response = await fetch(
      `${this.config.endpoint}/payments/${encodeURIComponent(providerRef)}`,
      {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      return {
        status: "failed",
        failureReason: `Verification failed (HTTP ${response.status})`,
      };
    }

    const data = (await response.json()) as {
      status?: string;
      amount?: number;
      currency?: string;
      id?: string;
    };

    // Amount is re-checked here: a gateway session could otherwise be replayed
    // against a different, more expensive order.
    if (data.amount !== undefined && data.amount !== context.amountMinor) {
      return {
        status: "failed",
        failureReason: "Paid amount does not match the order total.",
        providerRef,
      };
    }

    const succeeded = ["succeeded", "captured", "paid", "success"].includes(
      (data.status ?? "").toLowerCase(),
    );

    return {
      status: succeeded ? "succeeded" : "failed",
      providerRef: data.id ?? providerRef,
      failureReason: succeeded ? undefined : `Gateway reported status "${data.status}"`,
      payload: { status: data.status, currency: data.currency },
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!this.config.webhookSecret || !signature) return false;

    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const provided = signature.replace(/^sha256=/, "");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
