"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { adminLoginFormAction } from "@/app/actions/admin-actions";

/**
 * Progressively enhanced: the browser can post this form natively, so signing
 * in works before React hydrates and even if its JavaScript never loads.
 */
export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminLoginFormAction, {
    error: null as string | null,
  });

  return (
    <form action={formAction} className="comic-card grid gap-3 p-4">
      {state.error && (
        <p role="alert" className="rounded border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {state.error}
        </p>
      )}

      <div>
        <label className="field-label" htmlFor="admin-user">Username</label>
        <input
          id="admin-user"
          name="username"
          className="field"
          autoComplete="username"
          required
        />
      </div>

      <div>
        <label className="field-label" htmlFor="admin-pass">Password</label>
        <input
          id="admin-pass"
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-dark w-full">
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
