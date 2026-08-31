/**
 * Payment abstraction.
 *
 * The real gateway is supplied by the store owner later, so nothing here
 * assumes one. Two rules this interface exists to enforce:
 *
 *   1. An order is never marked paid because the browser said so. Only
 *      `confirm` (server-side verification or a signed webhook) can do that.
 *   2. Credentials stay server-side; the client only ever sees the fields in
 *      `PaymentInstruction`.
 */

export interface PaymentContext {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: string;
  customerPhone: string;
  customerName: string;
}

/** What the customer is shown after placing the order. */
export interface PaymentInstruction {
  /** "redirect" sends the browser to the gateway; "manual" shows instructions. */
  kind: "manual" | "redirect";
  method: string;
  status: "pending" | "succeeded";
  redirectUrl?: string;
  reference?: string;
  instructions?: string[];
}

export interface PaymentConfirmation {
  status: "succeeded" | "failed" | "pending";
  providerRef?: string;
  failureReason?: string;
  payload?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;

  /** Payment methods this provider can currently accept. */
  supportedMethods(): string[];

  /** Starts a payment and returns what to show the customer. */
  initiate(context: PaymentContext, method: string): Promise<PaymentInstruction>;

  /**
   * Verifies a payment server-side. Called from the return URL and from the
   * webhook — never trusted from a client-supplied success flag.
   */
  confirm(
    context: PaymentContext,
    providerRef: string,
  ): Promise<PaymentConfirmation>;

  /**
   * Validates a webhook signature. Returning false must cause the caller to
   * reject the request; an unsigned webhook can mark any order paid.
   */
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
}
