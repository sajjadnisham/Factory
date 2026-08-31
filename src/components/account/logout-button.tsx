"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { logoutAction } from "@/app/actions/checkout-actions";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await logoutAction();
          router.push("/");
          router.refresh();
        })
      }
      className="btn btn-ghost w-full text-sm"
    >
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
