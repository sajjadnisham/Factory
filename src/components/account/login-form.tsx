"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  loginRequestOtpAction,
  loginVerifyOtpAction,
} from "@/app/actions/checkout-actions";

/** Passwordless sign-in: phone number, OTP, done. */
export function LoginForm() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode() {
    setError(null);
    setBusy(true);
    const result = await loginRequestOtpAction(phoneInput);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      if (result.retryAfterSeconds) setCooldown(result.retryAfterSeconds);
      return;
    }
    setPhone(result.phone);
    setCooldown(60);
  }

  async function verify() {
    if (!phone) return;
    setError(null);
    setBusy(true);
    const submitted = code;
    const result = await loginVerifyOtpAction({ phone, code: submitted });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      // Preserve anything typed while the request was in flight.
      setCode((current) => (current === submitted ? "" : current));
      return;
    }
    router.refresh();
  }

  return (
    <div className="comic-card grid gap-3 p-4">
      {error && (
        <p role="alert" className="rounded border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {error}
        </p>
      )}

      {!phone ? (
        <>
          <div>
            <label className="field-label" htmlFor="login-phone">Phone number</label>
            <div className="flex items-stretch gap-2">
              <span className="flex items-center rounded-lg border-[2.5px] border-[var(--color-ink)] bg-[var(--color-paper)] px-3 font-bold">
                +960
              </span>
              <input
                id="login-phone"
                className="field"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="7771234"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={requestCode}
            disabled={busy}
            className="btn btn-primary w-full"
          >
            {busy ? "Sending…" : "Send OTP"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm">
            We sent a code to <strong>+960 {phoneInput}</strong>.
          </p>
          <div>
            <label className="field-label" htmlFor="login-code">Verification code</label>
            <input
              id="login-code"
              className="field text-center text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="••••"
            />
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={busy || code.length < 4}
            className="btn btn-primary w-full"
          >
            {busy ? "Checking…" : "Verify & sign in"}
          </button>
          <div className="flex justify-between text-xs">
            <button
              type="button"
              onClick={requestCode}
              disabled={cooldown > 0 || busy}
              className="font-bold uppercase underline disabled:opacity-40"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
            </button>
            <button
              type="button"
              onClick={() => { setPhone(null); setCode(""); }}
              className="uppercase underline"
            >
              Change number
            </button>
          </div>
        </>
      )}
    </div>
  );
}
