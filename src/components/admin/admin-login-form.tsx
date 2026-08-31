"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { adminLoginAction } from "@/app/actions/admin-actions";

export function AdminLoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await adminLoginAction({ username, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="comic-card grid gap-3 p-4">
      {error && (
        <p role="alert" className="rounded border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {error}
        </p>
      )}

      <div>
        <label className="field-label" htmlFor="admin-user">Username</label>
        <input
          id="admin-user"
          className="field"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="admin-pass">Password</label>
        <input
          id="admin-pass"
          type="password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <button type="submit" disabled={pending} className="btn btn-dark w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
