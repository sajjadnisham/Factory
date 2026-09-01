import { env } from "@/lib/env";
import { maskPhone } from "@/lib/phone";

/**
 * SMS delivery abstraction. No provider is hardcoded — the real Maldivian SMS
 * gateway is configured through environment variables once it is chosen, and
 * only this file changes.
 */
export interface OtpSender {
  readonly name: string;
  send(phone: string, code: string): Promise<void>;
}

/**
 * Development sender. Prints the code to the server console — never used in
 * production, which env() enforces at startup.
 */
class ConsoleOtpSender implements OtpSender {
  readonly name = "console";

  async send(phone: string, code: string): Promise<void> {
    console.info(
      `[otp] development code for ${maskPhone(phone)}: ${code} (console provider — not for production)`,
    );
  }
}

/**
 * Generic REST gateway: POST {to, message} with a bearer token. Most SMS
 * providers fit this shape; those that do not need only a new class here.
 */
class HttpOtpSender implements OtpSender {
  readonly name = "http";

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly senderId?: string,
  ) {}

  async send(phone: string, code: string): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        to: phone,
        from: this.senderId,
        message: `Your verification code is ${code}. It expires in ${Math.round(env().OTP_TTL_SECONDS / 60)} minutes.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // The body may echo the message (and therefore the code), so it is not
      // logged. Only the status reaches the logs.
      throw new Error(`SMS provider rejected the request (HTTP ${response.status})`);
    }
  }
}

/**
 * Demo sender: delivers nothing. The code reaches the browser through the
 * checkout action instead — see src/lib/demo.ts for why this exists and what it
 * gives up.
 */
class DemoOtpSender implements OtpSender {
  readonly name = "demo";

  async send(phone: string, _code: string): Promise<void> {
    console.info(`[otp] demo mode — code for ${maskPhone(phone)} shown on screen, no SMS sent`);
  }
}

let cached: OtpSender | null = null;

export function getOtpSender(): OtpSender {
  if (cached) return cached;
  const config = env();

  switch (config.OTP_PROVIDER) {
    case "http":
      cached = new HttpOtpSender(
        config.SMS_HTTP_ENDPOINT!,
        config.SMS_HTTP_API_KEY!,
        config.SMS_SENDER_ID,
      );
      break;
    case "demo":
      cached = new DemoOtpSender();
      break;
    default:
      cached = new ConsoleOtpSender();
  }

  return cached;
}
