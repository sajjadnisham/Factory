"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateProfileAction } from "@/app/actions/account-actions";

export function ProfileForm({
  initialName,
  phoneDisplay,
}: {
  initialName: string;
  phoneDisplay: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <label className="field-label" htmlFor="pf-name">Full name</label>
        <input
          id="pf-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>

      <div>
        <span className="field-label">Phone number</span>
        <p className="rounded-lg border-2 border-[var(--color-mist)] bg-[var(--color-paper)] px-3 py-2.5 text-sm">
          {phoneDisplay}
        </p>
        <p className="mt-1 text-xs text-[var(--color-steel)]">
          Your number is your account, so it cannot be changed here. Contact the
          store if you need to move your orders to a new number.
        </p>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await updateProfileAction({ name });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage("Profile updated.");
            router.refresh();
          });
        }}
        className="btn btn-primary w-full"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
