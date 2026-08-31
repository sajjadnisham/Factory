"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  placeOrderAction,
  requestOtpAction,
  verifyOtpAction,
  type SavedAddressSummary,
} from "@/app/actions/checkout-actions";
import { formatMvr } from "@/lib/money";

interface Props {
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  itemCount: number;
  deliveryAreas: string[];
  paymentMethods: { id: string; label: string; description: string }[];
  signedInName: string | null;
  signedInPhone: string | null;
}

type Step = "details" | "otp" | "address" | "payment";

/**
 * The checkout the brief specifies: no registration wall, phone verified by
 * OTP, address saved for next time, account created automatically once the
 * first order lands.
 */
export function CheckoutFlow({
  subtotalMinor,
  deliveryFeeMinor,
  totalMinor,
  itemCount,
  deliveryAreas,
  paymentMethods,
  signedInName,
  signedInPhone,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(signedInName ?? "");
  const [phoneInput, setPhoneInput] = useState(
    signedInPhone?.replace("+960", "") ?? "",
  );
  const [phone, setPhone] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);

  const [addressLine, setAddressLine] = useState("");
  const [area, setArea] = useState(deliveryAreas[0] ?? "");
  const [island, setIsland] = useState("");
  const [instructions, setInstructions] = useState("");
  const [savedAddress, setSavedAddress] = useState<SavedAddressSummary | null>(null);
  const [useSaved, setUseSaved] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]?.id ?? "");

  const codeRef = useRef<HTMLInputElement>(null);

  // Resend cooldown, driven by the server's own limit.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "otp") codeRef.current?.focus();
  }, [step]);

  async function sendCode(resend = false) {
    setError(null);
    if (!resend && name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }

    setBusy(true);
    const result = await requestOtpAction(phoneInput);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      if (result.retryAfterSeconds) setCooldown(result.retryAfterSeconds);
      return;
    }

    setPhone(result.phone);
    setIsReturning(result.isReturning);
    setCooldown(60);
    setStep("otp");
  }

  async function submitCode() {
    if (!phone) return;
    setError(null);
    setBusy(true);
    const submitted = code;
    const result = await verifyOtpAction({ phone, code: submitted });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      // Only clear what was actually rejected — on a slow connection the
      // customer may already be retyping, and wiping that would be maddening.
      setCode((current) => (current === submitted ? "" : current));
      return;
    }

    setVerifiedToken(result.verifiedToken);
    if (result.customerName && name.trim().length < 2) setName(result.customerName);

    if (result.savedAddress) {
      setSavedAddress(result.savedAddress);
      setAddressLine(result.savedAddress.addressLine);
      setArea(result.savedAddress.area);
      setIsland(result.savedAddress.island);
      setInstructions(result.savedAddress.instructions ?? "");
    }
    setStep("address");
  }

  async function submitOrder() {
    if (!phone || !verifiedToken) return;
    setError(null);
    setBusy(true);

    const result = await placeOrderAction({
      phone,
      verifiedToken,
      name,
      addressLine,
      area,
      island,
      instructions,
      paymentMethod,
      saveAddress: true,
    });

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      // A consumed token cannot be reused, so send them back to verify.
      if (result.error.includes("verification")) {
        setVerifiedToken(null);
        setStep("otp");
      }
      return;
    }

    router.push(`/order/${result.orderNumber}?placed=1`);
  }

  return (
    <div className="grid gap-4">
      <ol className="flex gap-1.5 text-[10px] font-bold uppercase">
        {(["details", "otp", "address", "payment"] as Step[]).map((s, i) => (
          <li
            key={s}
            className={`flex-1 rounded border-2 border-[var(--color-ink)] px-1.5 py-1 text-center ${
              step === s
                ? "bg-[var(--color-volt)]"
                : stepIndex(step) > i
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-white text-[var(--color-steel)]"
            }`}
          >
            {["You", "Verify", "Address", "Pay"][i]}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="rounded-lg border-2 border-[var(--color-danger)] bg-white p-3 text-sm">
          {error}
        </p>
      )}

      {/* --- Step 1: name + phone ---------------------------------------- */}
      {step === "details" && (
        <section className="comic-card grid gap-3 p-4">
          <h2 className="section-title text-lg">Your details</h2>

          <div>
            <label className="field-label" htmlFor="co-name">Full name</label>
            <input
              id="co-name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Ahmed Ibrahim"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="co-phone">Phone number</label>
            <div className="flex items-stretch gap-2">
              <span className="flex items-center rounded-lg border-[2.5px] border-[var(--color-ink)] bg-[var(--color-paper)] px-3 font-bold">
                +960
              </span>
              <input
                id="co-phone"
                className="field"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="7771234"
                maxLength={12}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-steel)]">
              We send a code to confirm your number. No password needed.
            </p>
          </div>

          <button
            type="button"
            onClick={() => sendCode()}
            disabled={busy}
            className="btn btn-primary w-full"
          >
            {busy ? "Sending…" : "Send OTP"}
          </button>
        </section>
      )}

      {/* --- Step 2: OTP -------------------------------------------------- */}
      {step === "otp" && (
        <section className="comic-card grid gap-3 p-4">
          <h2 className="section-title text-lg">Verify your number</h2>
          <p className="text-sm text-[var(--color-graphite)]">
            We sent a verification code to{" "}
            <strong>+960 {phoneInput}</strong>
            {isReturning && " — welcome back."}
          </p>

          <div>
            <label className="field-label" htmlFor="co-code">Verification code</label>
            <input
              id="co-code"
              ref={codeRef}
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
            onClick={submitCode}
            disabled={busy || code.length < 4}
            className="btn btn-primary w-full"
          >
            {busy ? "Checking…" : "Verify"}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => sendCode(true)}
              disabled={cooldown > 0 || busy}
              className="font-bold uppercase underline disabled:opacity-40"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("details"); setCode(""); }}
              className="uppercase underline"
            >
              Change number
            </button>
          </div>
        </section>
      )}

      {/* --- Step 3: address ---------------------------------------------- */}
      {step === "address" && (
        <section className="comic-card grid gap-3 p-4">
          <h2 className="section-title text-lg">Delivery address</h2>

          {savedAddress && useSaved ? (
            <div className="rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-3">
              <p className="text-xs font-bold uppercase text-[var(--color-success)]">
                ✓ Use saved address
              </p>
              <p className="mt-1.5 text-sm">
                {savedAddress.recipientName}
                <br />
                {savedAddress.addressLine}
                <br />
                {savedAddress.area}
                {savedAddress.island ? `, ${savedAddress.island}` : ""}
              </p>
              <button
                type="button"
                onClick={() => setUseSaved(false)}
                className="btn btn-ghost mt-3 text-xs"
              >
                Edit address
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="field-label" htmlFor="co-address">Address</label>
                <textarea
                  id="co-address"
                  className="field"
                  rows={3}
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  autoComplete="street-address"
                  placeholder="House name, street, floor / apartment"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="co-area">Area / city</label>
                <select
                  id="co-area"
                  className="field"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  {deliveryAreas.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="co-island">
                  Island (optional)
                </label>
                <input
                  id="co-island"
                  className="field"
                  value={island}
                  onChange={(e) => setIsland(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="co-instructions">
                  Delivery instructions (optional)
                </label>
                <input
                  id="co-instructions"
                  className="field"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Call on arrival"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (addressLine.trim().length < 5) {
                setError("Enter your delivery address.");
                return;
              }
              setError(null);
              setStep("payment");
            }}
            className="btn btn-primary w-full"
          >
            Continue to payment
          </button>
        </section>
      )}

      {/* --- Step 4: payment ---------------------------------------------- */}
      {step === "payment" && (
        <section className="comic-card grid gap-3 p-4">
          <h2 className="section-title text-lg">Payment</h2>

          <fieldset className="grid gap-2">
            <legend className="field-label">Payment method</legend>
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className={`flex cursor-pointer gap-2.5 rounded-lg border-2 border-[var(--color-ink)] p-3 ${
                  paymentMethod === method.id ? "bg-[var(--color-volt)]" : "bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={method.id}
                  checked={paymentMethod === method.id}
                  onChange={() => setPaymentMethod(method.id)}
                  className="mt-0.5 h-5 w-5 accent-[var(--color-ink)]"
                />
                <span>
                  <span className="block text-sm font-bold uppercase">{method.label}</span>
                  <span className="block text-xs text-[var(--color-graphite)]">
                    {method.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <dl className="rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-3 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal ({itemCount} item{itemCount === 1 ? "" : "s"})</dt>
              <dd>{formatMvr(subtotalMinor)}</dd>
            </div>
            <div className="mt-1 flex justify-between">
              <dt>Delivery</dt>
              <dd>{deliveryFeeMinor === 0 ? "Free" : formatMvr(deliveryFeeMinor)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t-2 border-[var(--color-ink)] pt-2 font-black">
              <dt>Total</dt>
              <dd>{formatMvr(totalMinor)}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={submitOrder}
            disabled={busy || !paymentMethod}
            className="btn btn-primary w-full text-base"
          >
            {busy ? "Placing order…" : `Place order · ${formatMvr(totalMinor)}`}
          </button>

          <button
            type="button"
            onClick={() => setStep("address")}
            className="text-xs uppercase underline"
          >
            Back to address
          </button>
        </section>
      )}
    </div>
  );
}

function stepIndex(step: Step): number {
  return ["details", "otp", "address", "payment"].indexOf(step);
}
