"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { adminLogoutAction } from "@/app/actions/admin-actions";

export function AdminLogout() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await adminLogoutAction();
          router.push("/admin");
          router.refresh();
        })
      }
      className="rounded border-2 border-[var(--color-volt)] px-2 py-1 text-xs font-bold uppercase text-[var(--color-volt)]"
    >
      {pending ? "…" : "Log out"}
    </button>
  );
}
