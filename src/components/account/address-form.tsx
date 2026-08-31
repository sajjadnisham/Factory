"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveAddressAction } from "@/app/actions/account-actions";

interface Props {
  deliveryAreas: string[];
  initial: {
    recipientName: string;
    addressLine: string;
    area: string;
    island: string;
    instructions: string;
  } | null;
  fallbackName: string;
}

export function AddressForm({ deliveryAreas, initial, fallbackName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [recipientName, setRecipientName] = useState(
    initial?.recipientName ?? fallbackName,
  );
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? "");
  const [area, setArea] = useState(initial?.area ?? deliveryAreas[0] ?? "");
  const [island, setIsland] = useState(initial?.island ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveAddressAction({
        recipientName,
        addressLine,
        area,
        island,
        instructions,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Address saved.");
      router.refresh();
    });
  }

  return (
    <div className="comic-card grid gap-3 p-4">
      {error && (
        <p role="alert" className="rounded border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded border-2 border-[var(--color-success)] bg-white p-2.5 text-sm">
          {message}
        </p>
      )}

      <div>
        <label className="field-label" htmlFor="ad-name">Recipient name</label>
        <input
          id="ad-name"
          className="field"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          autoComplete="name"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="ad-line">Address</label>
        <textarea
          id="ad-line"
          className="field"
          rows={3}
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          autoComplete="street-address"
          placeholder="House name, street, floor / apartment"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="ad-area">Area / city</label>
        <select
          id="ad-area"
          className="field"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          {[...new Set([area, ...deliveryAreas])].filter(Boolean).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="ad-island">Island (optional)</label>
        <input
          id="ad-island"
          className="field"
          value={island}
          onChange={(e) => setIsland(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="ad-instructions">
          Delivery instructions (optional)
        </label>
        <input
          id="ad-instructions"
          className="field"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Call on arrival"
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="btn btn-primary w-full"
      >
        {pending ? "Saving…" : "Save address"}
      </button>
    </div>
  );
}
