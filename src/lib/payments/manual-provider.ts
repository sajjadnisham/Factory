import type {
  PaymentConfirmation,
  PaymentContext,
  PaymentInstruction,
  PaymentProvider,
} from "./types";

/**
 * Offline payments — bank transfer and cash on delivery — the default until a
 * real gateway is supplied.
 *
 * The order is created as `pending`, never `paid`: an admin marks it paid after
 * seeing the transfer, which is exactly the "do not fake successful payment"
 * rule the brief requires.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";

  supportedMethods(): string[] {
    return ["bank_transfer", "cash_on_delivery"];
  }

  async initiate(
    context: PaymentContext,
    method: string,
  ): Promise<PaymentInstruction> {
    if (method === "cash_on_delivery") {
      return {
        kind: "manual",
        method,
        status: "pending",
        reference: context.orderNumber,
        instructions: [
          `Have MVR ${(context.amountMinor / 100).toLocaleString("en-US")} ready for the rider.`,
          "Your order is confirmed once we call to arrange delivery.",
        ],
      };
    }

    return {
      kind: "manual",
      method,
      status: "pending",
      reference: context.orderNumber,
      instructions: [
        `Transfer MVR ${(context.amountMinor / 100).toLocaleString("en-US")} to the store bank account.`,
        `Use ${context.orderNumber} as the transfer reference.`,
        "Send the receipt to the store on WhatsApp so we can confirm your order.",
      ],
    };
  }

  async confirm(): Promise<PaymentConfirmation> {
    // There is nothing to verify automatically: a human confirms the transfer
    // in the admin panel. Reporting "pending" keeps the order unpaid.
    return {
      status: "pending",
      failureReason: "Manual payments are confirmed by store staff.",
    };
  }

  verifyWebhookSignature(): boolean {
    // No webhooks for offline payments — never accept one.
    return false;
  }
}
