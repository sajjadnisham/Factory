"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  cancelOrderAction,
  markOrderPaidAction,
  updateOrderStatusAction,
} from "@/app/actions/admin-actions";

const STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "out_for_delivery",
  "delivered",
] as const;

export function OrderAdminControls({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  const cancelled = status === "cancelled";

  return (
    <div className="grid gap-4">
      {error && (
        <p role="alert" className="rounded border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {error}
        </p>
      )}

      <div>
        <span className="field-label">Order status</span>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              disabled={pending || cancelled || option === status}
              onClick={() => run(() => updateOrderStatusAction(orderId, option))}
              className={`btn px-3 text-xs ${option === status ? "btn-primary" : "btn-ghost"}`}
            >
              {option.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        {cancelled && (
          <p className="mt-1.5 text-xs text-[var(--color-danger)]">
            This order is cancelled and its stock has been returned.
          </p>
        )}
      </div>

      {paymentStatus !== "paid" && !cancelled && (
        <div>
          <label className="field-label" htmlFor="pay-ref">
            Confirm payment received
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="pay-ref"
              className="field max-w-xs"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer reference (optional)"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markOrderPaidAction(orderId, reference))}
              className="btn btn-primary text-sm"
            >
              Mark as paid
            </button>
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-steel)]">
            Only mark an order paid after seeing the money. The customer's
            confirmation screen never sets this.
          </p>
        </div>
      )}

      {!cancelled && (
        <div>
          <span className="field-label">Cancel order</span>
          {!confirmingCancel ? (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="btn btn-ghost text-xs"
            >
              Cancel this order
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input
                className="field max-w-xs"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (shown in history)"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => cancelOrderAction(orderId, cancelReason))}
                className="btn text-xs"
                style={{ background: "var(--color-danger)", color: "white" }}
              >
                Confirm cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                className="btn btn-ghost text-xs"
              >
                Keep order
              </button>
            </div>
          )}
          <p className="mt-1.5 text-xs text-[var(--color-steel)]">
            Cancelling returns every item to stock.
          </p>
        </div>
      )}
    </div>
  );
}
