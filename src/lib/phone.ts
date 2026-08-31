/**
 * Phone numbers are the customer's identity, so they are normalised to E.164
 * before any lookup — otherwise "7771234", "+9607771234" and "960 777 1234"
 * would each create a separate account.
 */

const DEFAULT_COUNTRY_CODE = "960"; // Maldives

export interface NormalisedPhone {
  e164: string;
  national: string;
}

export function normalisePhone(input: string): NormalisedPhone | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits === "") return null;

  let national: string;
  if (digits.startsWith("+")) {
    const withoutPlus = digits.slice(1);
    if (!withoutPlus.startsWith(DEFAULT_COUNTRY_CODE)) {
      // Other country codes are accepted as-is; only length is validated.
      if (withoutPlus.length < 8 || withoutPlus.length > 15) return null;
      return { e164: `+${withoutPlus}`, national: withoutPlus };
    }
    national = withoutPlus.slice(DEFAULT_COUNTRY_CODE.length);
  } else if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length > 9) {
    national = digits.slice(DEFAULT_COUNTRY_CODE.length);
  } else {
    national = digits;
  }

  // Maldivian mobile numbers are 7 digits and start with 7 or 9.
  if (!/^[79]\d{6}$/.test(national)) return null;

  return { e164: `+${DEFAULT_COUNTRY_CODE}${national}`, national };
}

/** "+960 777 1234" for display. */
export function formatPhone(e164: string): string {
  const match = /^\+960(\d{3})(\d{4})$/.exec(e164);
  if (!match) return e164;
  return `+960 ${match[1]} ${match[2]}`;
}

/** "+960 ••• 1234" — used in OTP screens and logs. */
export function maskPhone(e164: string): string {
  const match = /^\+960(\d{3})(\d{4})$/.exec(e164);
  if (!match) return e164.replace(/\d(?=\d{4})/g, "•");
  return `+960 ••• ${match[2]}`;
}
