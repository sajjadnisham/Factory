"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { toggleProductActiveAction } from "@/app/actions/admin-actions";

export function ProductActiveToggle({
  productId,
  active,
}: {
  productId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleProductActiveAction(productId, !active);
          router.refresh();
        })
      }
      className="btn btn-ghost px-2.5 text-[10px]"
    >
      {pending ? "…" : active ? "Hide" : "Show"}
    </button>
  );
}
